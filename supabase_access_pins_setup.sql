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
-- 2. VALIDATE ACCESS PIN FUNCTION
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
    d.full_name    AS doctor_name
  INTO v_record
  FROM access_pins ap
  JOIN clinics c ON c.id::text = ap.clinic_id
  LEFT JOIN clinic_locations loc ON loc.id::text = ap.location_id
  LEFT JOIN doctors d ON d.id::text = ap.doctor_id
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
    'success',      true,
    'clinic_id',    v_record.clinic_id,
    'location_id',  v_record.location_id,
    'doctor_id',    v_record.doctor_id,
    'label',        v_record.label,
    'clinic_name',  v_record.clinic_name,
    'branch_name',  v_record.branch_name,
    'doctor_name',  v_record.doctor_name,
    'has_branch',   v_record.location_id IS NOT NULL,
    'has_doctor',   v_record.doctor_id IS NOT NULL
  );
END;
$func$;

-- ============================================================================
-- 3. SEED ACCESS PINS FOR ASTER PRIME & APOLLO HEALTH
-- ============================================================================
INSERT INTO public.access_pins (pin, clinic_id, location_id, doctor_id, label) VALUES
  -- ════════════════════════════════════════════
  -- ASTER PRIME CLINIC (ca996998-1b76-4869-b222-52746fe3c0f4)
  -- ════════════════════════════════════════════
  -- Admin: sees all branches + all doctors
  ('1000', 'ca996998-1b76-4869-b222-52746fe3c0f4', NULL, NULL,
   'Aster Prime — Admin'),
  -- Reception: Aster Edappally Hub, all doctors
  ('1001', 'ca996998-1b76-4869-b222-52746fe3c0f4', 'loc-aster-01', NULL,
   'Aster Edappally Hub — Reception'),
  -- Doctor desks: Aster Edappally Hub
  ('1101', 'ca996998-1b76-4869-b222-52746fe3c0f4', 'loc-aster-01', '85764c5f-73b9-482a-89c3-8ff2f604c170',
   'Aster — Dr. Sunny Kurian Desk'),
  ('1102', 'ca996998-1b76-4869-b222-52746fe3c0f4', 'loc-aster-01', 'ce5ec9cb-8981-4a1f-865b-f2c1726a3970',
   'Aster — Dr. Divya Nambiar Desk'),

  -- ════════════════════════════════════════════
  -- APOLLO HEALTH CLINIC (c714c4c3-e1ba-4f9c-bac9-ed20763d6f5c)
  -- ════════════════════════════════════════════
  -- Admin: sees all branches + all doctors
  ('2000', 'c714c4c3-e1ba-4f9c-bac9-ed20763d6f5c', NULL, NULL,
   'Apollo Health — Admin'),
  -- Reception: Apollo Panampilly, all doctors
  ('2001', 'c714c4c3-e1ba-4f9c-bac9-ed20763d6f5c', 'loc-apollo-01', NULL,
   'Apollo Panampilly — Reception'),
  -- Doctor desks: Apollo Panampilly
  ('2101', 'c714c4c3-e1ba-4f9c-bac9-ed20763d6f5c', 'loc-apollo-01', 'e9710ae2-72ba-404b-823e-8d9c5891ecde',
   'Apollo — Dr. Faisal Khan Desk'),
  ('2102', 'c714c4c3-e1ba-4f9c-bac9-ed20763d6f5c', 'loc-apollo-01', '62a12676-6394-41c0-8b78-36605443eacd',
   'Apollo — Dr. Ananya Ramesh Desk')
ON CONFLICT (pin) DO UPDATE SET
  clinic_id = EXCLUDED.clinic_id,
  location_id = EXCLUDED.location_id,
  doctor_id = EXCLUDED.doctor_id,
  label = EXCLUDED.label,
  is_active = true;

-- Verification query
SELECT pin, label, 
  CASE WHEN location_id IS NULL THEN 'All Branches' ELSE location_id END AS branch,
  CASE WHEN doctor_id IS NULL THEN 'All Doctors' ELSE doctor_id END AS doctor
FROM public.access_pins
ORDER BY pin;
