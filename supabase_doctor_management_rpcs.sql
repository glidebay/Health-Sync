-- ════════════════════════════════════════════════════════════════════════════
-- 1. SAFE SCHEMA EXTENSION FOR DOCTORS & BRANCH SCOPE
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.doctors
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS specialization text DEFAULT 'Consultant Physician',
  ADD COLUMN IF NOT EXISTS reg_no text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS daily_quota integer DEFAULT 40,
  ADD COLUMN IF NOT EXISTS pin_code text,
  ADD COLUMN IF NOT EXISTS is_admin_doctor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. RPC: GET ALL DOCTORS FOR CLINIC (With Branch Allocations & Live Counts)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_clinic_doctors_admin(
  p_clinic_id text,
  p_admin_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_is_admin boolean := false;
  v_doctors jsonb;
BEGIN
  -- Security Gate: Only Admin PIN can view doctor management
  SELECT EXISTS (
    SELECT 1 FROM public.access_pins
    WHERE pin = trim(p_admin_pin)
      AND clinic_id::text = p_clinic_id
      AND location_id IS NULL
      AND is_active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ACCESS_DENIED', 'error_message', 'Only Clinic Administrator can manage doctors.');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'full_name', d.full_name,
        'specialization', COALESCE(d.specialization, 'Consultant Physician'),
        'reg_no', COALESCE(d.reg_no, 'N/A'),
        'daily_quota', COALESCE(d.daily_quota, 40),
        'phone', COALESCE(d.phone, ''),
        'is_admin_doctor', COALESCE(d.is_admin_doctor, false),
        'is_active', COALESCE(d.is_active, true),
        'chamber_pin', (
          SELECT pin FROM public.access_pins ap 
          WHERE ap.doctor_id::text = d.id::text AND ap.is_active = true 
          LIMIT 1
        ),
        'branches', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', loc.id,
              'branch_name', loc.branch_name,
              'branch_code', loc.branch_code
            )
          )
          FROM public.access_pins ap
          JOIN public.clinic_locations loc ON loc.id::text = ap.location_id::text
          WHERE ap.doctor_id::text = d.id::text AND ap.is_active = true
        ), '[]'::jsonb),
        'is_all_branches', (
          SELECT EXISTS (
            SELECT 1 FROM public.access_pins ap
            WHERE ap.doctor_id::text = d.id::text AND ap.location_id IS NULL AND ap.is_active = true
          )
        ),
        'today_patient_count', (
          SELECT count(*)::int FROM public.appointments a
          WHERE a.doctor_id = d.id
            AND date(a.scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
            AND a.status NOT IN ('Cancelled', 'Reallocated')
        )
      ) ORDER BY d.is_admin_doctor DESC, d.full_name ASC
    ), '[]'::jsonb
  ) INTO v_doctors
  FROM public.doctors d
  WHERE d.clinic_id::text = p_clinic_id AND d.is_active = true;

  RETURN jsonb_build_object(
    'success', true,
    'clinic_id', p_clinic_id,
    'doctor_count', jsonb_array_length(v_doctors),
    'doctors', v_doctors
  );
END;
$func$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. RPC: ADMIN ADD NEW DOCTOR
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_create_doctor(
  p_clinic_id       text,
  p_admin_pin       text,
  p_full_name       text,
  p_specialization  text,
  p_reg_no          text,
  p_daily_quota     integer DEFAULT 40,
  p_phone           text DEFAULT NULL,
  p_chamber_pin     text DEFAULT '1234',
  p_is_admin_doctor boolean DEFAULT false,
  p_branch_ids      text[] DEFAULT NULL -- NULL means 'All Branches'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_is_admin boolean := false;
  v_doc_id uuid := gen_random_uuid();
  v_loc_id text;
  v_clean_pin text;
BEGIN
  -- 1. Security Check
  SELECT EXISTS (
    SELECT 1 FROM public.access_pins
    WHERE pin = trim(p_admin_pin) AND clinic_id::text = p_clinic_id AND location_id IS NULL AND is_active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ACCESS_DENIED', 'error_message', 'Only Admin can add doctors.');
  END IF;

  -- 2. Validations
  IF p_full_name IS NULL OR length(trim(p_full_name)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_NAME', 'error_message', 'Doctor name must be at least 3 characters.');
  END IF;

  IF p_daily_quota < 1 OR p_daily_quota > 500 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_QUOTA', 'error_message', 'Daily quota must be between 1 and 500.');
  END IF;

  v_clean_pin := trim(COALESCE(p_chamber_pin, '1234'));
  IF length(v_clean_pin) < 4 OR length(v_clean_pin) > 6 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_PIN', 'error_message', 'Chamber PIN must be 4 to 6 digits.');
  END IF;

  -- Check PIN collision
  IF EXISTS (SELECT 1 FROM public.access_pins WHERE pin = v_clean_pin AND clinic_id::text = p_clinic_id) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PIN_IN_USE', 'error_message', 'Chamber PIN ' || v_clean_pin || ' is already assigned to another staff/doctor. Please choose another PIN.');
  END IF;

  -- 3. Insert Doctor
  INSERT INTO public.doctors (
    id, clinic_id, full_name, specialization, reg_no, phone,
    daily_quota, pin_code, is_admin_doctor, is_active
  ) VALUES (
    v_doc_id, p_clinic_id::uuid, trim(p_full_name), trim(p_specialization),
    trim(p_reg_no), trim(p_phone), p_daily_quota, v_clean_pin,
    p_is_admin_doctor, true
  );

  -- 4. Assign Branches & Chamber PIN in access_pins
  IF p_branch_ids IS NULL OR array_length(p_branch_ids, 1) IS NULL THEN
    -- Scope: All Branches
    INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label, is_active)
    VALUES (v_clean_pin, p_clinic_id::uuid, NULL, v_doc_id::text, trim(p_full_name) || ' (All Branches)', true);
  ELSE
    -- Specific Branches
    FOREACH v_loc_id IN ARRAY p_branch_ids LOOP
      INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label, is_active)
      VALUES (v_clean_pin, p_clinic_id::uuid, v_loc_id, v_doc_id::text, trim(p_full_name) || ' Desk', true)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Doctor ' || trim(p_full_name) || ' added successfully.',
    'doctor_id', v_doc_id
  );
END;
$func$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. RPC: ADMIN UPDATE DOCTOR PROFILE & BRANCH ALLOCATIONS
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_update_doctor(
  p_clinic_id       text,
  p_admin_pin       text,
  p_doctor_id       uuid,
  p_full_name       text,
  p_specialization  text,
  p_reg_no          text,
  p_daily_quota     integer,
  p_phone           text DEFAULT NULL,
  p_chamber_pin     text DEFAULT NULL,
  p_is_admin_doctor boolean DEFAULT NULL,
  p_branch_ids      text[] DEFAULT NULL -- NULL means 'All Branches'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_is_admin boolean := false;
  v_loc_id text;
  v_clean_pin text;
BEGIN
  -- 1. Security Check
  SELECT EXISTS (
    SELECT 1 FROM public.access_pins
    WHERE pin = trim(p_admin_pin) AND clinic_id::text = p_clinic_id AND location_id IS NULL AND is_active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ACCESS_DENIED', 'error_message', 'Only Admin can update doctors.');
  END IF;

  -- 2. Update Doctor Profile
  UPDATE public.doctors
  SET
    full_name       = COALESCE(trim(p_full_name), full_name),
    specialization  = COALESCE(trim(p_specialization), specialization),
    reg_no          = COALESCE(trim(p_reg_no), reg_no),
    daily_quota     = COALESCE(p_daily_quota, daily_quota),
    phone           = COALESCE(trim(p_phone), phone),
    is_admin_doctor = COALESCE(p_is_admin_doctor, is_admin_doctor),
    updated_at      = now()
  WHERE id = p_doctor_id AND clinic_id::text = p_clinic_id;

  -- 3. Update Chamber PIN if provided
  IF p_chamber_pin IS NOT NULL AND trim(p_chamber_pin) <> '' THEN
    v_clean_pin := trim(p_chamber_pin);
    UPDATE public.doctors SET pin_code = v_clean_pin WHERE id = p_doctor_id;
  ELSE
    SELECT pin_code INTO v_clean_pin FROM public.doctors WHERE id = p_doctor_id;
  END IF;

  -- 4. Re-sync Branch Allocations in access_pins
  DELETE FROM public.access_pins WHERE doctor_id::text = p_doctor_id::text;

  IF p_branch_ids IS NULL OR array_length(p_branch_ids, 1) IS NULL THEN
    INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label, is_active)
    VALUES (v_clean_pin, p_clinic_id::uuid, NULL, p_doctor_id::text, trim(p_full_name) || ' (All Branches)', true);
  ELSE
    FOREACH v_loc_id IN ARRAY p_branch_ids LOOP
      INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label, is_active)
      VALUES (v_clean_pin, p_clinic_id::uuid, v_loc_id, p_doctor_id::text, trim(p_full_name) || ' Desk', true);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Doctor profile and branch allocations updated successfully.'
  );
END;
$func$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. RPC: ADMIN DELETE DOCTOR (Soft-Delete with Appointment Safety)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_delete_doctor(
  p_clinic_id text,
  p_admin_pin text,
  p_doctor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_is_admin boolean := false;
  v_active_appointments int := 0;
BEGIN
  -- 1. Security Check
  SELECT EXISTS (
    SELECT 1 FROM public.access_pins
    WHERE pin = trim(p_admin_pin) AND clinic_id::text = p_clinic_id AND location_id IS NULL AND is_active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ACCESS_DENIED', 'error_message', 'Only Admin can remove doctors.');
  END IF;

  -- 2. Guard: Admin Doctor cannot be deleted
  IF EXISTS (SELECT 1 FROM public.doctors WHERE id = p_doctor_id AND is_admin_doctor = true) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CANNOT_DELETE_ADMIN',
      'error_message', 'Admin doctor cannot be deleted from the clinic roster.'
    );
  END IF;

  -- 3. Check if doctor has active patients today
  SELECT count(*) INTO v_active_appointments
  FROM public.appointments
  WHERE doctor_id = p_doctor_id
    AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
    AND status IN ('Waiting', 'In Progress');

  IF v_active_appointments > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACTIVE_APPOINTMENTS',
      'error_message', 'Cannot delete this doctor. There are ' || v_active_appointments || ' patients currently waiting in their chamber queue today. Please reallocate or complete visits first.'
    );
  END IF;

  -- 3. Soft-delete (preserve medical logs and prescriptions) & deactivate PIN
  UPDATE public.doctors SET is_active = false, updated_at = now() WHERE id = p_doctor_id;
  UPDATE public.access_pins SET is_active = false WHERE doctor_id::text = p_doctor_id::text;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Doctor removed from clinic active directory successfully.'
  );
END;
$func$;

-- Grant RPC execution permissions
GRANT EXECUTE ON FUNCTION public.get_clinic_doctors_admin(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_doctor(text, text, text, text, text, integer, text, text, boolean, text[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_doctor(text, text, uuid, text, text, text, integer, text, text, boolean, text[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_doctor(text, text, uuid) TO authenticated, anon;
