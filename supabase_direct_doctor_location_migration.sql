-- ════════════════════════════════════════════════════════════════════════════
-- DIRECT DOCTOR LOCATION MIGRATION & UPDATED RPCS
-- ════════════════════════════════════════════════════════════════════════════

-- 1. ADD location_id COLUMN DIRECTLY TO public.doctors
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS location_id text 
REFERENCES public.clinic_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doctors_location_id ON public.doctors(location_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_location ON public.doctors(clinic_id, location_id);

-- 2. MIGRATE DATA FROM SEPARATE TABLES & ACCESS_PINS INTO doctors.location_id
DO $$
BEGIN
  -- A. Migrate from access_pins
  UPDATE public.doctors d
  SET location_id = ap.location_id
  FROM public.access_pins ap
  WHERE ap.doctor_id IS NOT NULL 
    AND ap.doctor_id <> ''
    AND ap.doctor_id::text = d.id::text
    AND ap.location_id IS NOT NULL
    AND ap.location_id <> ''
    AND d.location_id IS NULL;

  -- B. Migrate from doctor_branch_assignments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doctor_branch_assignments') THEN
    UPDATE public.doctors d
    SET location_id = dba.location_id
    FROM public.doctor_branch_assignments dba
    WHERE d.location_id IS NULL
      AND dba.doctor_id = d.id
      AND dba.location_id IS NOT NULL;
  END IF;

  -- C. Migrate from doctor_locations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doctor_locations') THEN
    UPDATE public.doctors d
    SET location_id = dl.location_id
    FROM public.doctor_locations dl
    WHERE d.location_id IS NULL
      AND dl.doctor_id = d.id
      AND dl.location_id IS NOT NULL;
  END IF;
END $$;

-- 3. REWRITE get_clinic_doctors_admin (Direct Single JOIN)
CREATE OR REPLACE FUNCTION public.get_clinic_doctors_admin(p_clinic_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  specialization text,
  reg_no text,
  consultation_fee numeric,
  daily_quota integer,
  pin_code text,
  is_admin_doctor boolean,
  is_active boolean,
  location_id text,
  branch_name text,
  branch_code text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    d.id,
    d.full_name,
    d.specialization,
    d.reg_no,
    d.consultation_fee,
    d.daily_quota,
    d.pin_code,
    COALESCE(d.is_admin_doctor, false) AS is_admin_doctor,
    COALESCE(d.is_active, true) AS is_active,
    d.location_id,
    COALESCE(loc.branch_name, 'All Branches') AS branch_name,
    COALESCE(loc.branch_code, 'ALL') AS branch_code,
    d.created_at
  FROM public.doctors d
  LEFT JOIN public.clinic_locations loc ON loc.id = d.location_id
  WHERE d.clinic_id = p_clinic_id
    AND (d.is_deleted IS NULL OR d.is_deleted = false)
  ORDER BY 
    d.is_admin_doctor DESC,
    loc.branch_name NULLS FIRST,
    d.full_name ASC;
$$;

-- Overload for text parameter clinic_id if invoked with text
CREATE OR REPLACE FUNCTION public.get_clinic_doctors_admin(p_clinic_id text)
RETURNS TABLE (
  id uuid,
  full_name text,
  specialization text,
  reg_no text,
  consultation_fee numeric,
  daily_quota integer,
  pin_code text,
  is_admin_doctor boolean,
  is_active boolean,
  location_id text,
  branch_name text,
  branch_code text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_clinic_doctors_admin(p_clinic_id::uuid);
$$;

-- 4. REWRITE admin_create_doctor (Saves location_id directly in doctors)
CREATE OR REPLACE FUNCTION public.admin_create_doctor(
  p_clinic_id uuid,
  p_full_name text,
  p_specialization text,
  p_reg_no text,
  p_consultation_fee numeric,
  p_daily_quota integer,
  p_pin_code text,
  p_is_admin_doctor boolean,
  p_location_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_doctor_id uuid;
  v_existing_pin_count integer;
  v_assigned_location text;
BEGIN
  -- Validate inputs
  IF TRIM(COALESCE(p_full_name, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Doctor full name is required');
  END IF;

  IF LENGTH(TRIM(COALESCE(p_pin_code, ''))) <> 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Login PIN must be exactly 4 digits');
  END IF;

  -- Verify PIN uniqueness across the clinic
  SELECT COUNT(*) INTO v_existing_pin_count
  FROM public.doctors
  WHERE clinic_id = p_clinic_id
    AND pin_code = TRIM(p_pin_code)
    AND (is_deleted IS NULL OR is_deleted = false);

  IF v_existing_pin_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN ' || p_pin_code || ' is already assigned to another doctor');
  END IF;

  -- Sanitize location_id: empty string means All Branches (NULL)
  v_assigned_location := NULLIF(TRIM(p_location_id), '');

  -- Insert directly into doctors table
  INSERT INTO public.doctors (
    clinic_id,
    full_name,
    specialization,
    reg_no,
    consultation_fee,
    daily_quota,
    pin_code,
    is_admin_doctor,
    is_active,
    is_deleted,
    location_id
  ) VALUES (
    p_clinic_id,
    TRIM(p_full_name),
    TRIM(COALESCE(p_specialization, 'General Physician')),
    TRIM(COALESCE(p_reg_no, '')),
    COALESCE(p_consultation_fee, 500.00),
    COALESCE(p_daily_quota, 30),
    TRIM(p_pin_code),
    COALESCE(p_is_admin_doctor, false),
    true,
    false,
    v_assigned_location
  )
  RETURNING id INTO v_new_doctor_id;

  -- Also synchronize with access_pins for PIN authentication
  DELETE FROM public.access_pins 
  WHERE clinic_id::text = p_clinic_id::text AND pin = TRIM(p_pin_code);

  INSERT INTO public.access_pins (
    pin,
    clinic_id,
    location_id,
    doctor_id,
    label
  ) VALUES (
    TRIM(p_pin_code),
    p_clinic_id::text,
    v_assigned_location,
    v_new_doctor_id::text,
    TRIM(p_full_name) || ' Chamber'
  );

  RETURN jsonb_build_object(
    'success', true,
    'doctor_id', v_new_doctor_id,
    'message', 'Doctor created successfully with direct branch location'
  );
END;
$$;

-- Overload for text clinic_id
CREATE OR REPLACE FUNCTION public.admin_create_doctor(
  p_clinic_id text,
  p_full_name text,
  p_specialization text,
  p_reg_no text,
  p_consultation_fee numeric,
  p_daily_quota integer,
  p_pin_code text,
  p_is_admin_doctor boolean,
  p_location_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_create_doctor(
    p_clinic_id::uuid,
    p_full_name,
    p_specialization,
    p_reg_no,
    p_consultation_fee,
    p_daily_quota,
    p_pin_code,
    p_is_admin_doctor,
    p_location_id
  );
$$;

-- 5. REWRITE admin_update_doctor (Updates location_id directly in doctors)
CREATE OR REPLACE FUNCTION public.admin_update_doctor(
  p_doctor_id uuid,
  p_full_name text,
  p_specialization text,
  p_reg_no text,
  p_consultation_fee numeric,
  p_daily_quota integer,
  p_pin_code text,
  p_is_admin_doctor boolean,
  p_is_active boolean,
  p_location_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_existing_pin_count integer;
  v_assigned_location text;
BEGIN
  -- Get clinic_id
  SELECT clinic_id INTO v_clinic_id
  FROM public.doctors
  WHERE id = p_doctor_id AND (is_deleted IS NULL OR is_deleted = false);

  IF v_clinic_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Doctor not found');
  END IF;

  -- Verify PIN uniqueness (excluding this doctor)
  IF p_pin_code IS NOT NULL AND TRIM(p_pin_code) <> '' THEN
    IF LENGTH(TRIM(p_pin_code)) <> 4 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Login PIN must be exactly 4 digits');
    END IF;

    SELECT COUNT(*) INTO v_existing_pin_count
    FROM public.doctors
    WHERE clinic_id = v_clinic_id
      AND pin_code = TRIM(p_pin_code)
      AND id <> p_doctor_id
      AND (is_deleted IS NULL OR is_deleted = false);

    IF v_existing_pin_count > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'PIN ' || p_pin_code || ' is already used by another doctor');
    END IF;
  END IF;

  v_assigned_location := NULLIF(TRIM(p_location_id), '');

  -- Update doctors directly
  UPDATE public.doctors
  SET 
    full_name = TRIM(p_full_name),
    specialization = TRIM(COALESCE(p_specialization, specialization)),
    reg_no = TRIM(COALESCE(p_reg_no, reg_no)),
    consultation_fee = COALESCE(p_consultation_fee, consultation_fee),
    daily_quota = COALESCE(p_daily_quota, daily_quota),
    pin_code = COALESCE(TRIM(p_pin_code), pin_code),
    is_admin_doctor = COALESCE(p_is_admin_doctor, is_admin_doctor),
    is_active = COALESCE(p_is_active, is_active),
    location_id = v_assigned_location,
    updated_at = now()
  WHERE id = p_doctor_id;

  -- Sync access_pins
  DELETE FROM public.access_pins 
  WHERE doctor_id::text = p_doctor_id::text;

  IF p_pin_code IS NOT NULL AND TRIM(p_pin_code) <> '' THEN
    INSERT INTO public.access_pins (
      pin,
      clinic_id,
      location_id,
      doctor_id,
      label
    ) VALUES (
      TRIM(p_pin_code),
      v_clinic_id::text,
      v_assigned_location,
      p_doctor_id::text,
      TRIM(p_full_name) || ' Chamber'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Doctor details and branch location updated successfully'
  );
END;
$$;

-- Overload for text doctor_id
CREATE OR REPLACE FUNCTION public.admin_update_doctor(
  p_doctor_id text,
  p_full_name text,
  p_specialization text,
  p_reg_no text,
  p_consultation_fee numeric,
  p_daily_quota integer,
  p_pin_code text,
  p_is_admin_doctor boolean,
  p_is_active boolean,
  p_location_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_update_doctor(
    p_doctor_id::uuid,
    p_full_name,
    p_specialization,
    p_reg_no,
    p_consultation_fee,
    p_daily_quota,
    p_pin_code,
    p_is_admin_doctor,
    p_is_active,
    p_location_id
  );
$$;

-- 6. ADMIN DELETE DOCTOR (With Admin Protection & Active Appointment Guard)
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
  v_active_appointments int := 0;
  v_is_admin boolean := false;
BEGIN
  -- 1. Guard: Admin Doctor cannot be deleted
  SELECT is_admin_doctor INTO v_is_admin
  FROM public.doctors
  WHERE id = p_doctor_id;

  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin doctor cannot be deleted from the clinic roster.'
    );
  END IF;

  -- 2. Guard: Active Queue Appointments today
  SELECT count(*) INTO v_active_appointments
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

  -- 3. Soft delete
  UPDATE public.doctors 
  SET is_active = false, is_deleted = true, updated_at = now() 
  WHERE id = p_doctor_id;

  UPDATE public.access_pins 
  SET is_active = false 
  WHERE doctor_id::text = p_doctor_id::text;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Doctor deleted successfully.'
  );
END;
$$;

-- Overloads
CREATE OR REPLACE FUNCTION public.admin_delete_doctor(p_clinic_id text, p_doctor_id text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.admin_delete_doctor(p_clinic_id::uuid, p_doctor_id::uuid);
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_clinic_doctors_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_clinic_doctors_admin(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_doctor(uuid, text, text, text, numeric, integer, text, boolean, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_doctor(text, text, text, text, numeric, integer, text, boolean, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_doctor(uuid, text, text, text, numeric, integer, text, boolean, boolean, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_doctor(text, text, text, text, numeric, integer, text, boolean, boolean, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_doctor(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_doctor(text, text) TO authenticated, anon;
