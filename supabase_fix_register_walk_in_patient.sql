-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1: DROP ALL OLD CONFLICTING VERSIONS (Removes ambiguity)
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

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2: INSTALL THE NEW ZERO-EGRESS BRANCH-WISE FUNCTION
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.register_walk_in_patient(
  p_full_name       text,
  p_phone_number    text,
  p_location_id     text,                         -- Branch ID (e.g. 'loc-apollo-01')
  p_doctor_id       uuid DEFAULT NULL,            -- Doctor ID (Optional: auto-assigns if NULL)
  p_clinic_id       text DEFAULT NULL,            -- Clinic ID (Optional: resolved from branch)
  p_age             integer DEFAULT NULL,
  p_gender          text DEFAULT NULL,
  p_priority        text DEFAULT 'Normal',        -- 'Normal' or 'Urgent'
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
  v_start_time time;
  v_end_time time;
  v_start_timestamptz timestamptz;
  v_end_timestamptz timestamptz;
  v_candidate_slot timestamptz;
  v_booking_time timestamptz;
  v_found boolean := false;
BEGIN
  -- 1. Input Sanitization
  v_clean_name := trim(COALESCE(p_full_name, ''));
  IF v_clean_name = '' OR length(v_clean_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_NAME', 'error_message', 'Patient name must be at least 2 characters.');
  END IF;

  v_clean_phone := regexp_replace(trim(COALESCE(p_phone_number, '')), '[^0-9]', '', 'g');
  IF length(v_clean_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_PHONE', 'error_message', 'Phone number must contain at least 10 valid digits.');
  END IF;

  -- 2. Branch Resolution
  IF p_location_id IS NULL OR trim(p_location_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_BRANCH', 'error_message', 'Branch location is required.');
  END IF;

  SELECT loc.branch_name, loc.clinic_id, COALESCE(loc.daily_quota, 40), COALESCE(loc.slot_duration_mins, 15)
  INTO v_branch_name, v_resolved_clinic_id, v_daily_quota, v_slot_duration
  FROM public.clinic_locations loc
  WHERE loc.id::text = trim(p_location_id) AND loc.is_active = true
  LIMIT 1;

  IF v_branch_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'BRANCH_NOT_FOUND', 'error_message', 'Selected clinic branch is invalid or inactive.');
  END IF;

  IF p_clinic_id IS NOT NULL AND trim(p_clinic_id) <> '' THEN
    v_resolved_clinic_id := p_clinic_id::uuid;
  END IF;

  -- 3. Branch-Wise Doctor Resolution
  IF p_doctor_id IS NOT NULL THEN
    SELECT d.id, d.full_name, COALESCE(d.daily_quota, v_daily_quota)
    INTO v_resolved_doc_id, v_doctor_name, v_daily_quota
    FROM public.doctors d
    WHERE d.id = p_doctor_id;

    IF v_resolved_doc_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'DOCTOR_NOT_FOUND', 'error_message', 'Selected doctor not found.');
    END IF;

    -- Validate branch assignment
    IF NOT EXISTS (
      SELECT 1 FROM public.access_pins ap
      WHERE ap.doctor_id::text = v_resolved_doc_id::text
        AND (ap.location_id::text = trim(p_location_id) OR ap.location_id IS NULL)
        AND ap.is_active = true
    ) AND NOT EXISTS (
      SELECT 1 FROM public.doctors doc
      WHERE doc.id = v_resolved_doc_id AND doc.clinic_id = v_resolved_clinic_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'DOCTOR_BRANCH_MISMATCH',
        'error_message', v_doctor_name || ' is not practicing at ' || v_branch_name || '.');
    END IF;
  ELSE
    -- Auto-select active doctor with smallest queue at this branch
    SELECT d.id, d.full_name, COALESCE(d.daily_quota, v_daily_quota)
    INTO v_resolved_doc_id, v_doctor_name, v_daily_quota
    FROM public.access_pins ap
    JOIN public.doctors d ON d.id::text = ap.doctor_id::text
    WHERE ap.location_id::text = trim(p_location_id)
      AND ap.doctor_id IS NOT NULL
      AND ap.is_active = true
    ORDER BY (
      SELECT count(*) FROM public.appointments a 
      WHERE a.doctor_id = d.id 
        AND a.location_id::text = trim(p_location_id)
        AND date(a.scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
        AND a.status NOT IN ('Cancelled', 'Reallocated')
    ) ASC
    LIMIT 1;

    IF v_resolved_doc_id IS NULL THEN
      SELECT d.id, d.full_name, COALESCE(d.daily_quota, v_daily_quota)
      INTO v_resolved_doc_id, v_doctor_name, v_daily_quota
      FROM public.doctors d
      WHERE d.clinic_id = v_resolved_clinic_id
      LIMIT 1;
    END IF;

    IF v_resolved_doc_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'NO_DOCTOR_AVAILABLE', 'error_message', 'No active doctor found at ' || v_branch_name || '.');
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

  IF v_today_count >= v_daily_quota THEN
    IF p_priority = 'Urgent' AND v_allow_override = 'true' THEN
      NULL;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'QUOTA_FULL',
        'error_message', v_doctor_name || ' has reached daily quota of ' || v_daily_quota || ' at ' || v_branch_name || '.'
      );
    END IF;
  END IF;

  -- 5. Calculate Slot with Double-Booking Prevention
  IF p_scheduled_time IS NOT NULL THEN
    v_booking_time := p_scheduled_time;
    -- Ensure provided time does not collide with existing appointment for this doctor
    WHILE EXISTS (
      SELECT 1 FROM public.appointments
      WHERE doctor_id = v_resolved_doc_id
        AND scheduled_time = v_booking_time
        AND status NOT IN ('Cancelled', 'Reallocated')
    ) LOOP
      v_booking_time := v_booking_time + (v_slot_duration || ' minutes')::interval;
    END LOOP;
  ELSE
    SELECT start_time, end_time INTO v_start_time, v_end_time
    FROM public.doctor_schedules
    WHERE doctor_id = v_resolved_doc_id
      AND day_of_week IN (
        extract(dow FROM current_date)::smallint,
        extract(isodow FROM current_date)::smallint)
    LIMIT 1;

    v_start_time := COALESCE(v_start_time, time '08:00:00');
    v_end_time   := COALESCE(v_end_time,   time '22:00:00');
    v_start_timestamptz := (current_date || ' ' || v_start_time || ' Asia/Kolkata')::timestamptz;
    v_end_timestamptz   := (current_date || ' ' || v_end_time   || ' Asia/Kolkata')::timestamptz;

    IF now() < v_start_timestamptz THEN
      v_candidate_slot := v_start_timestamptz;
    ELSE
      v_candidate_slot := date_trunc('hour', now()) +
        (ceil(extract(minute FROM now())::numeric / v_slot_duration) * v_slot_duration * interval '1 minute');
      IF v_candidate_slot <= now() THEN
        v_candidate_slot := v_candidate_slot + (v_slot_duration || ' minutes')::interval;
      END IF;
    END IF;

    WHILE v_candidate_slot < v_end_timestamptz LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.appointments
        WHERE doctor_id = v_resolved_doc_id
          AND scheduled_time = v_candidate_slot
          AND status NOT IN ('Cancelled', 'Reallocated')
      ) THEN
        v_found := true;
        v_booking_time := v_candidate_slot;
        EXIT;
      END IF;
      v_candidate_slot := v_candidate_slot + (v_slot_duration || ' minutes')::interval;
    END LOOP;

    IF NOT v_found THEN
      -- Out of hours / late evening walk-in: calculate forward from current time
      v_booking_time := date_trunc('hour', now()) +
        (ceil(extract(minute FROM now())::numeric / v_slot_duration) * v_slot_duration * interval '1 minute');
      WHILE EXISTS (
        SELECT 1 FROM public.appointments
        WHERE doctor_id = v_resolved_doc_id
          AND scheduled_time = v_booking_time
          AND status NOT IN ('Cancelled', 'Reallocated')
      ) LOOP
        v_booking_time := v_booking_time + (v_slot_duration || ' minutes')::interval;
      END LOOP;
    END IF;
  END IF;

  -- 6. Upsert Patient
  SELECT id INTO v_patient_id FROM public.patients WHERE phone_number = v_clean_phone;

  IF v_patient_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.appointments
      WHERE patient_id = v_patient_id
        AND doctor_id = v_resolved_doc_id
        AND location_id::text = trim(p_location_id)
        AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
        AND status IN ('Waiting', 'In Progress')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'DUPLICATE_VISIT', 'error_message', 'Patient already has an active token today.');
    END IF;

    UPDATE public.patients
    SET full_name = v_clean_name,
        age = COALESCE(p_age, age),
        gender = COALESCE(p_gender, gender)
    WHERE id = v_patient_id;
  ELSE
    INSERT INTO public.patients (full_name, phone_number, age, gender)
    VALUES (v_clean_name, v_clean_phone, p_age, p_gender)
    RETURNING id INTO v_patient_id;
  END IF;

  -- 7. Generate Token
  SELECT count(*) + 1 INTO v_token_no
  FROM public.appointments
  WHERE doctor_id = v_resolved_doc_id
    AND location_id::text = trim(p_location_id)
    AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
    AND status NOT IN ('Cancelled', 'Reallocated');

  -- 8. Insert Appointment with Exception Handling for Double-Booking Unique Index
  BEGIN
    INSERT INTO public.appointments (
      patient_id, doctor_id, location_id, clinic_id,
      scheduled_time, status, visit_type, priority, queue_token_no
    )
    VALUES (
      v_patient_id, v_resolved_doc_id, trim(p_location_id), v_resolved_clinic_id,
      v_booking_time, 'Waiting', 'Walk-in', COALESCE(p_priority, 'Normal'), v_token_no
    )
    RETURNING id INTO v_appointment_id;
  EXCEPTION WHEN unique_violation THEN
    -- Fallback bump if race condition occurs on idx_no_double_booking
    WHILE EXISTS (
      SELECT 1 FROM public.appointments
      WHERE doctor_id = v_resolved_doc_id
        AND scheduled_time = v_booking_time
        AND status NOT IN ('Cancelled', 'Reallocated')
    ) LOOP
      v_booking_time := v_booking_time + (v_slot_duration || ' minutes')::interval;
    END LOOP;

    INSERT INTO public.appointments (
      patient_id, doctor_id, location_id, clinic_id,
      scheduled_time, status, visit_type, priority, queue_token_no
    )
    VALUES (
      v_patient_id, v_resolved_doc_id, trim(p_location_id), v_resolved_clinic_id,
      v_booking_time, 'Waiting', 'Walk-in', COALESCE(p_priority, 'Normal'), v_token_no
    )
    RETURNING id INTO v_appointment_id;
  END;

  -- 9. Ultra-Compact Return Payload
  RETURN jsonb_build_object(
    'success',            true,
    'appointment_id',     v_appointment_id,
    'patient_id',         v_patient_id,
    'patient_name',       v_clean_name,
    'doctor_name',        v_doctor_name,
    'branch_name',        v_branch_name,
    'queue_token_no',     v_token_no,
    'slot_time',          to_char(v_booking_time AT TIME ZONE 'Asia/Kolkata', 'hh12:mi AM'),
    'quota_status',       (v_today_count + 1) || '/' || v_daily_quota
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.register_walk_in_patient(text, text, text, uuid, text, integer, text, text, timestamptz) TO authenticated, anon;
