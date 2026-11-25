-- ============================================================================
-- 1. CREATE ACCESS PINS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.access_pins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pin text NOT NULL UNIQUE,
  clinic_id text NOT NULL,
  location_id text,
  doctor_id text,
  label text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 2. VALIDATE ACCESS PIN FUNCTION (Returns is_admin_doctor & roles cleanly)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_access_pin(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_record record;
BEGIN
  SELECT 
    ap.clinic_id,
    ap.location_id,
    ap.doctor_id,
    ap.label,
    c.name         AS clinic_name,
    loc.branch_name,
    d.full_name    AS doctor_name,
    COALESCE(d.is_admin_doctor, false) AS is_admin_doctor
  INTO v_record
  FROM public.access_pins ap
  JOIN public.clinics c ON c.id::text = ap.clinic_id
  LEFT JOIN public.clinic_locations loc ON loc.id::text = ap.location_id
  LEFT JOIN public.doctors d ON d.id::text = ap.doctor_id
  WHERE ap.pin = trim(p_pin)
    AND ap.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid PIN. Please try again.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'clinic_id',       v_record.clinic_id,
    'location_id',     v_record.location_id,
    'doctor_id',       v_record.doctor_id,
    'label',           v_record.label,
    'clinic_name',     v_record.clinic_name,
    'branch_name',     v_record.branch_name,
    'doctor_name',     v_record.doctor_name,
    'is_admin_doctor', v_record.is_admin_doctor,
    'has_branch',      v_record.location_id IS NOT NULL,
    'has_doctor',      v_record.doctor_id IS NOT NULL
  );
END;
$func$;

-- ============================================================================
-- 3. DYNAMICALLY SYNC ACCESS PINS FROM ACTUAL DOCTORS AND BRANCHES
-- ============================================================================
DO $$
DECLARE
  v_apollo_id text := 'c714c4c3-e1ba-4f9c-bac9-ed20763d6f5c';
  v_aster_id  text := 'ca996998-1b76-4869-b222-52746fe3c0f4';
  r_doc record;
BEGIN
  -- A. Master Clinic Admin PINs (All branches, all doctors)
  INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label)
  VALUES 
    ('1000', v_aster_id, NULL, NULL, 'Aster Prime — Admin'),
    ('2000', v_apollo_id, NULL, NULL, 'Apollo Health — Admin')
  ON CONFLICT (pin) DO UPDATE SET
    clinic_id   = EXCLUDED.clinic_id,
    location_id = EXCLUDED.location_id,
    doctor_id   = EXCLUDED.doctor_id,
    label       = EXCLUDED.label,
    is_active   = true;

  -- B. Reception Gateway PINs for Branches (with NULL doctor_id)
  -- Edappally Hub
  INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label)
  SELECT '1001', v_aster_id, id, NULL, 'Aster Edappally Hub — Reception'
  FROM public.clinic_locations 
  WHERE clinic_id::text = v_aster_id AND branch_name ILIKE '%Edappally%' 
  LIMIT 1
  ON CONFLICT (pin) DO UPDATE SET 
    clinic_id   = EXCLUDED.clinic_id, 
    location_id = EXCLUDED.location_id, 
    doctor_id   = EXCLUDED.doctor_id,
    label       = EXCLUDED.label, 
    is_active   = true;

  -- Panampilly Nagar
  INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label)
  SELECT '2001', v_apollo_id, id, NULL, 'Apollo Panampilly — Reception'
  FROM public.clinic_locations 
  WHERE clinic_id::text = v_apollo_id AND branch_name ILIKE '%Panampilly%' 
  LIMIT 1
  ON CONFLICT (pin) DO UPDATE SET 
    clinic_id   = EXCLUDED.clinic_id, 
    location_id = EXCLUDED.location_id, 
    doctor_id   = EXCLUDED.doctor_id,
    label       = EXCLUDED.label, 
    is_active   = true;

  -- C. Sync all active doctors from public.doctors table directly into access_pins
  FOR r_doc IN 
    SELECT id, clinic_id, location_id, pin_code, full_name 
    FROM public.doctors 
    WHERE pin_code IS NOT NULL 
      AND TRIM(pin_code) <> '' 
      AND (is_deleted IS NULL OR is_deleted = false)
  LOOP
    INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label)
    VALUES (
      TRIM(r_doc.pin_code),
      r_doc.clinic_id::text,
      r_doc.location_id,
      r_doc.id::text,
      r_doc.full_name || ' Chamber Desk'
    )
    ON CONFLICT (pin) DO UPDATE SET
      clinic_id   = EXCLUDED.clinic_id,
      location_id = EXCLUDED.location_id,
      doctor_id   = EXCLUDED.doctor_id,
      label       = EXCLUDED.label,
      is_active   = true;
  END LOOP;

END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 4. VERIFY PIN MAPPINGS
-- ============================================================================
SELECT 
  ap.pin, 
  c.name AS clinic,
  COALESCE(loc.branch_name, 'All Branches') AS branch,
  COALESCE(d.full_name, 'All Doctors / Reception') AS doctor_desk,
  ap.label
FROM public.access_pins ap
JOIN public.clinics c ON c.id::text = ap.clinic_id
LEFT JOIN public.clinic_locations loc ON loc.id::text = ap.location_id
LEFT JOIN public.doctors d ON d.id::text = ap.doctor_id
ORDER BY ap.pin;
