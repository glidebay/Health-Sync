-- ════════════════════════════════════════════════════════════════════════════
-- FIX 1: REPLACE register_walk_in_patient
-- - Uses direct doctors.location_id (NO doctor_branch_assignments / doctor_locations)
-- - Inserts status = 'Waiting' (matches appointments_status_check constraint)
-- - Uses Phone + Name composite matching (supports family members sharing phone)
-- - Parameter order matches live Supabase RPC call
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'register_walk_in_patient'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.func_sig || ' CASCADE;';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.register_walk_in_patient(
  p_clinic_id       uuid,
  p_location_id     text,
  p_doctor_id       uuid DEFAULT NULL,
  p_full_name       text DEFAULT '',
  p_phone_number    text DEFAULT '',
  p_age             integer DEFAULT NULL,
  p_gender          text DEFAULT NULL,
  p_priority        text DEFAULT 'Normal',
  p_scheduled_time  timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_patient_id uuid;
  v_appointment_id uuid;
  v_clean_phone text;
  v_clean_name text;
  v_resolved_doc_id uuid;
  v_doctor_name text;
  v_resolved_clinic_id uuid;
  v_branch_name text;
  v_daily_quota integer;
  v_slot_duration integer;
  v_allow_override text := 'true';
  v_today_count integer := 0;
  v_token_no integer := 1;
  v_booking_time timestamptz;
BEGIN
  -- 1. Input Validation
  v_clean_name := trim(COALESCE(p_full_name, ''));
  IF v_clean_name = '' OR length(v_clean_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_NAME', 'error', 'Patient name must be at least 2 characters.');
  END IF;

  v_clean_phone := regexp_replace(trim(COALESCE(p_phone_number, '')), '[^0-9]', '', 'g');
  IF length(v_clean_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_PHONE', 'error', 'Invalid phone number. Minimum 10 digits required.');
  END IF;

  -- 2. Branch Resolution
  IF p_location_id IS NULL OR trim(p_location_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_BRANCH', 'error', 'Branch location is required.');
  END IF;

  SELECT loc.branch_name, loc.clinic_id, COALESCE(loc.daily_quota, 40), COALESCE(loc.slot_duration_mins, 15)
  INTO v_branch_name, v_resolved_clinic_id, v_daily_quota, v_slot_duration
  FROM public.clinic_locations loc
  WHERE loc.id::text = trim(p_location_id) AND loc.is_active = true
  LIMIT 1;

  IF v_branch_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BRANCH_NOT_FOUND', 'error', 'Selected clinic branch is invalid or inactive.');
  END IF;

  IF p_clinic_id IS NOT NULL THEN
    v_resolved_clinic_id := p_clinic_id;
  END IF;

  -- 3. Direct Doctor Resolution via doctors.location_id (NO doctor_branch_assignments)
  IF p_doctor_id IS NOT NULL THEN
    SELECT d.id, d.full_name, COALESCE(d.daily_quota, v_daily_quota)
    INTO v_resolved_doc_id, v_doctor_name, v_daily_quota
    FROM public.doctors d
    WHERE d.id = p_doctor_id
      AND COALESCE(d.is_active, true) = true
      AND (d.is_deleted IS NULL OR d.is_deleted = false);

    IF v_resolved_doc_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'DOCTOR_NOT_FOUND', 'error', 'Selected doctor not found.');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = v_resolved_doc_id
        AND d.clinic_id = v_resolved_clinic_id
        AND (d.location_id IS NULL OR d.location_id = trim(p_location_id) OR COALESCE(d.is_admin_doctor, false) = true)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'DOCTOR_BRANCH_MISMATCH', 'error', v_doctor_name || ' is not practicing at ' || v_branch_name || '.');
    END IF;
  ELSE
    SELECT d.id, d.full_name, COALESCE(d.daily_quota, v_daily_quota)
    INTO v_resolved_doc_id, v_doctor_name, v_daily_quota
    FROM public.doctors d
    WHERE d.clinic_id = v_resolved_clinic_id
      AND COALESCE(d.is_active, true) = true
      AND (d.is_deleted IS NULL OR d.is_deleted = false)
      AND (d.location_id = trim(p_location_id) OR d.location_id IS NULL OR COALESCE(d.is_admin_doctor, false) = true)
    ORDER BY (d.location_id = trim(p_location_id)) DESC, d.is_admin_doctor ASC, d.full_name ASC
    LIMIT 1;

    IF v_resolved_doc_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'NO_DOCTOR_AVAILABLE', 'error', 'No active doctor found at ' || v_branch_name || '.');
    END IF;
  END IF;

  -- 4. Quota Gate
  SELECT COALESCE(value, 'true') INTO v_allow_override FROM public.app_config WHERE key = 'allow_quota_override';
  PERFORM 1 FROM public.doctors WHERE id = v_resolved_doc_id FOR UPDATE;

  SELECT count(*) INTO v_today_count
  FROM public.appointments
  WHERE doctor_id = v_resolved_doc_id
    AND location_id::text = trim(p_location_id)
    AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
    AND status NOT IN ('Cancelled', 'Reallocated');

  IF v_today_count >= v_daily_quota AND NOT (p_priority = 'Urgent' AND v_allow_override = 'true') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'QUOTA_FULL', 'error', v_doctor_name || ' has reached daily quota of ' || v_daily_quota || '.');
  END IF;

  -- 5. Slot Calculation
  v_booking_time := COALESCE(p_scheduled_time, now());
  WHILE EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id = v_resolved_doc_id
      AND scheduled_time = v_booking_time
      AND status NOT IN ('Cancelled', 'Reallocated')
  ) LOOP
    v_booking_time := v_booking_time + (v_slot_duration || ' minutes')::interval;
  END LOOP;

  -- 6. Patient Identity Resolution (Phone + Name Composite Matching)
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE right(regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g'), 10) = right(v_clean_phone, 10)
    AND lower(trim(full_name)) = lower(v_clean_name)
  LIMIT 1;

  IF v_patient_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.appointments
      WHERE patient_id = v_patient_id
        AND doctor_id = v_resolved_doc_id
        AND location_id::text = trim(p_location_id)
        AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
        AND status IN ('Waiting', 'In Progress')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'DUPLICATE_VISIT', 'error', 'Patient already has an active token today.');
    END IF;

    UPDATE public.patients
    SET age = COALESCE(p_age, age),
        gender = COALESCE(p_gender, gender)
    WHERE id = v_patient_id;
  ELSE
    INSERT INTO public.patients (full_name, phone_number, age, gender)
    VALUES (v_clean_name, right(v_clean_phone, 10), p_age, p_gender)
    RETURNING id INTO v_patient_id;
  END IF;

  -- 7. Generate Sequential Token
  SELECT count(*) + 1 INTO v_token_no
  FROM public.appointments
  WHERE doctor_id = v_resolved_doc_id
    AND location_id::text = trim(p_location_id)
    AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
    AND status NOT IN ('Cancelled', 'Reallocated');

  -- 8. Insert Appointment with Title-Case 'Waiting' (satisfies appointments_status_check)
  INSERT INTO public.appointments (
    patient_id, doctor_id, location_id, clinic_id,
    scheduled_time, status, visit_type, priority, queue_token_no
  )
  VALUES (
    v_patient_id, v_resolved_doc_id, trim(p_location_id), v_resolved_clinic_id,
    v_booking_time, 'Waiting', 'Walk-in', COALESCE(p_priority, 'Normal'), v_token_no
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success',        true,
    'appointment_id', v_appointment_id,
    'patient_id',     v_patient_id,
    'patient_name',   v_clean_name,
    'doctor_name',    v_doctor_name,
    'branch_name',    v_branch_name,
    'status',         'Waiting',
    'queue_token_no', v_token_no,
    'slot_time',      to_char(v_booking_time AT TIME ZONE 'Asia/Kolkata', 'hh12:mi AM'),
    'quota_status',   (v_today_count + 1) || '/' || v_daily_quota
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.register_walk_in_patient(uuid, text, uuid, text, text, integer, text, text, timestamptz) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 2: CLEAN UP admin_delete_doctor (Removes doctor_branch_assignments refs)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'admin_delete_doctor'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.func_sig || ' CASCADE;';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_doctor(
  p_clinic_id uuid,
  p_doctor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_active_appointments integer;
BEGIN
  SELECT COALESCE(is_admin_doctor, false) INTO v_is_admin
  FROM public.doctors
  WHERE id = p_doctor_id AND clinic_id = p_clinic_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Doctor not found in this clinic');
  END IF;

  IF v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete an Admin Doctor');
  END IF;

  SELECT COUNT(*) INTO v_active_appointments
  FROM public.appointments
  WHERE doctor_id = p_doctor_id
    AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
    AND status IN ('Waiting', 'In Progress');

  IF v_active_appointments > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete doctor: ' || v_active_appointments || ' patients are waiting in their queue today.'
    );
  END IF;

  UPDATE public.doctors
  SET is_active = false, is_deleted = true, updated_at = now()
  WHERE id = p_doctor_id AND clinic_id = p_clinic_id;

  UPDATE public.access_pins
  SET is_active = false
  WHERE doctor_id::text = p_doctor_id::text;

  RETURN jsonb_build_object('success', true, 'message', 'Doctor deleted successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_doctor(uuid, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
