-- ============================================================================
-- GLIDEBAY HEALTHSYNC: ENTERPRISE CLMS MASTER INTEGRATION ENGINE
-- 1. Master Data: Clinic Branding, Doctors, Shifts, Generic Molecules, Inventory
-- 2. Patient Onboarding: Multi-Doctor Selection, Dynamic Buffers, Double-Booking Guard
-- 3. Consultation: Medical History, Next-Visit Follow-Up, Legal Rx Format
-- 4. Analytics: Footfall & Channel Breakdown, Case Mix & Pharmacy Valuation
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. DOCTORS MASTER TABLE (Upgraded with Credentials, Pin & Quota)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID,
  full_name TEXT NOT NULL,
  specialization TEXT NOT NULL DEFAULT 'General Medicine',
  reg_no TEXT NOT NULL DEFAULT 'MCI-00000',
  daily_quota INTEGER NOT NULL DEFAULT 30 CHECK (daily_quota > 0 AND daily_quota <= 200),
  consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  pin_code TEXT NOT NULL DEFAULT '1234',
  photo_url TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all target columns exist if table was already created
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS auth_id UUID;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS specialization TEXT DEFAULT 'General Medicine';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS reg_no TEXT DEFAULT 'MCI-00000';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS daily_quota INTEGER DEFAULT 30;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2) DEFAULT 500.00;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS pin_code TEXT DEFAULT '1234';
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors(is_active);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON public.doctors(specialization);

-- Seed Dr. Sunny as primary physician if not present
INSERT INTO public.doctors (full_name, specialization, reg_no, daily_quota, consultation_fee, pin_code, is_active)
SELECT 'Dr. Sunny', 'Consultant Physician & Diabetologist', 'KMC-45892', 35, 500.00, '1234', true
WHERE NOT EXISTS (SELECT 1 FROM public.doctors WHERE full_name ILIKE '%Sunny%');

-- ----------------------------------------------------------------------------
-- 2. DOCTOR WEEKLY SHIFTS & BUFFER SLOTS TABLE (Defensive Column Upgrades)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  slot_duration_mins INTEGER NOT NULL DEFAULT 15,
  buffer_mins INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if table was created in an earlier migration
ALTER TABLE public.doctor_schedules ADD COLUMN IF NOT EXISTS slot_duration_mins INTEGER DEFAULT 15;
ALTER TABLE public.doctor_schedules ADD COLUMN IF NOT EXISTS buffer_mins INTEGER DEFAULT 0;
ALTER TABLE public.doctor_schedules ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT '09:00:00';
ALTER TABLE public.doctor_schedules ADD COLUMN IF NOT EXISTS end_time TIME DEFAULT '17:00:00';
ALTER TABLE public.doctor_schedules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.doctor_schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure unique constraint exists for upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_doctor_schedule_day'
  ) THEN
    ALTER TABLE public.doctor_schedules ADD CONSTRAINT uq_doctor_schedule_day UNIQUE (doctor_id, day_of_week);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doc ON public.doctor_schedules(doctor_id, day_of_week);

-- Seed Monday to Saturday shifts for Dr. Sunny
INSERT INTO public.doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_mins, buffer_mins, is_active)
SELECT d.id, dow.d, '09:00:00'::TIME, '17:00:00'::TIME, 15, 5, true
FROM public.doctors d
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6)) AS dow(d)
WHERE d.full_name ILIKE '%Sunny%'
ON CONFLICT (doctor_id, day_of_week) DO UPDATE 
SET slot_duration_mins = EXCLUDED.slot_duration_mins,
    buffer_mins = EXCLUDED.buffer_mins;

-- ----------------------------------------------------------------------------
-- 3. DAILY SCHEDULE OVERRIDES & HOLIDAYS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_holiday BOOLEAN NOT NULL DEFAULT false,
  quota_override INTEGER CHECK (quota_override > 0),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS doctor_id UUID;
ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT false;
ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS quota_override INTEGER;
ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_doctor_date_override'
  ) THEN
    ALTER TABLE public.daily_schedules ADD CONSTRAINT uq_doctor_date_override UNIQUE (doctor_id, date);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_schedules_doc_date ON public.daily_schedules(doctor_id, date);

-- ----------------------------------------------------------------------------
-- 4. GENERIC MOLECULE & THERAPEUTIC CATEGORY MASTER
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generic_molecules (
  id TEXT PRIMARY KEY DEFAULT ('mol-' || substr(md5(random()::text), 1, 10)),
  molecule_name TEXT NOT NULL,
  strength TEXT NOT NULL,
  dosage_form TEXT NOT NULL DEFAULT 'Tablet',
  therapeutic_category TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.generic_molecules ADD COLUMN IF NOT EXISTS molecule_name TEXT;
ALTER TABLE public.generic_molecules ADD COLUMN IF NOT EXISTS strength TEXT;
ALTER TABLE public.generic_molecules ADD COLUMN IF NOT EXISTS dosage_form TEXT DEFAULT 'Tablet';
ALTER TABLE public.generic_molecules ADD COLUMN IF NOT EXISTS therapeutic_category TEXT DEFAULT 'General';
ALTER TABLE public.generic_molecules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.generic_molecules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_generic_molecules_search ON public.generic_molecules (molecule_name, therapeutic_category);
CREATE UNIQUE INDEX IF NOT EXISTS uq_molecule_strength_form ON public.generic_molecules (lower(molecule_name), lower(strength), lower(dosage_form));

-- Seed standard generic molecules
INSERT INTO public.generic_molecules (molecule_name, strength, dosage_form, therapeutic_category)
VALUES 
  ('Paracetamol', '650mg', 'Tablet', 'Analgesic & Antipyretic'),
  ('Amoxicillin + Clavulanic Acid', '625mg', 'Tablet', 'Antibiotic'),
  ('Metformin HCl', '500mg', 'Tablet', 'Antidiabetic'),
  ('Telmisartan', '40mg', 'Tablet', 'Antihypertensive'),
  ('Pantoprazole', '40mg', 'Tablet', 'Gastrointestinal'),
  ('Cetirizine HCl', '10mg', 'Tablet', 'Antihistamine'),
  ('Azithromycin', '500mg', 'Tablet', 'Antibiotic')
ON CONFLICT (lower(molecule_name), lower(strength), lower(dosage_form)) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. UPGRADE INVENTORY SCHEMA WITH GENERIC LINK & ADVANCED SEARCH INDEX
-- ----------------------------------------------------------------------------
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS generic_id TEXT REFERENCES public.generic_molecules(id) ON DELETE SET NULL;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS manufacturer TEXT DEFAULT 'Standard Pharma';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS pack_size TEXT DEFAULT '10 Tablets';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS batch_no TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS reorder_threshold INTEGER DEFAULT 20;

CREATE INDEX IF NOT EXISTS idx_inventory_names ON public.inventory (generic_name, brand_name);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON public.inventory (expiry_date);

-- ----------------------------------------------------------------------------
-- 6. SYNCHRONIZE PATIENT PHONE NUMBER COLUMNS
-- ----------------------------------------------------------------------------
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone_number TEXT;

UPDATE public.patients 
SET phone = phone_number 
WHERE phone IS NULL AND phone_number IS NOT NULL;

UPDATE public.patients 
SET phone_number = phone 
WHERE phone_number IS NULL AND phone IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. APPOINTMENTS & PRESCRIBED MEDICATIONS UPGRADE
-- ----------------------------------------------------------------------------
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS next_visit_date DATE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS buffer_allocated_mins INTEGER DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booking_channel TEXT DEFAULT 'Walk-in';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consultation_duration_mins INTEGER DEFAULT 15;

-- Ensure prescribed_medications has necessary descriptive columns
CREATE TABLE IF NOT EXISTS public.prescribed_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  inventory_id TEXT,
  medicine_name TEXT,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  dispensed_quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prescribed_medications ADD COLUMN IF NOT EXISTS medicine_name TEXT;
ALTER TABLE public.prescribed_medications ADD COLUMN IF NOT EXISTS dosage TEXT;
ALTER TABLE public.prescribed_medications ADD COLUMN IF NOT EXISTS frequency TEXT;
ALTER TABLE public.prescribed_medications ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE public.prescribed_medications ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.prescribed_medications ADD COLUMN IF NOT EXISTS dispensed_quantity INTEGER DEFAULT 1;
ALTER TABLE public.prescribed_medications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- PARTIAL UNIQUE INDEX: PREVENTS DOUBLE-BOOKING PER DOCTOR PER TIME
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_double_booking 
ON public.appointments (doctor_id, scheduled_time) 
WHERE status NOT IN ('Cancelled', 'Reallocated');

-- ----------------------------------------------------------------------------
-- 8. ATOMIC RPC: GET DYNAMIC AVAILABLE SLOTS WITH BUFFER & HOLIDAY RULES
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_doctor_available_slots(
  p_doctor_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'Asia/Kolkata'
AS $$
DECLARE
  v_day_of_week INT;
  v_shift RECORD;
  v_override RECORD;
  v_slot_duration INT;
  v_buffer INT;
  v_quota INT;
  v_booked_count INT;
  v_curr_time TIME;
  v_slot_start TIMESTAMPTZ;
  v_is_booked BOOLEAN;
  v_slots JSONB := '[]'::JSONB;
  v_total_slots INT := 0;
  v_available_count INT := 0;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT * INTO v_override 
  FROM public.daily_schedules 
  WHERE doctor_id = p_doctor_id AND date = p_date;

  IF FOUND AND v_override.is_holiday THEN
    RETURN jsonb_build_object(
      'is_holiday', true,
      'reason', COALESCE(v_override.reason, 'Doctor is on Leave / Clinic Holiday'),
      'slots', '[]'::JSONB,
      'available_count', 0
    );
  END IF;

  SELECT * INTO v_shift 
  FROM public.doctor_schedules 
  WHERE doctor_id = p_doctor_id AND day_of_week = v_day_of_week AND is_active = true;

  IF NOT FOUND THEN
    v_shift.start_time := '09:00:00'::TIME;
    v_shift.end_time := '17:00:00'::TIME;
    v_shift.slot_duration_mins := 15;
    v_shift.buffer_mins := 5;
  END IF;

  v_slot_duration := COALESCE(v_shift.slot_duration_mins, 15);
  v_buffer := COALESCE(v_shift.buffer_mins, 0);

  IF v_override.quota_override IS NOT NULL AND v_override.quota_override > 0 THEN
    v_quota := v_override.quota_override;
  ELSE
    SELECT daily_quota INTO v_quota FROM public.doctors WHERE id = p_doctor_id;
    v_quota := COALESCE(v_quota, 35);
  END IF;

  SELECT COUNT(*) INTO v_booked_count
  FROM public.appointments
  WHERE doctor_id = p_doctor_id 
    AND scheduled_time::DATE = p_date
    AND status NOT IN ('Cancelled', 'Reallocated');

  v_curr_time := v_shift.start_time;

  WHILE v_curr_time + (v_slot_duration || ' minutes')::INTERVAL <= v_shift.end_time LOOP
    v_slot_start := (p_date::TEXT || ' ' || v_curr_time::TEXT)::TIMESTAMPTZ;
    v_total_slots := v_total_slots + 1;

    SELECT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE doctor_id = p_doctor_id
        AND scheduled_time = v_slot_start
        AND status NOT IN ('Cancelled', 'Reallocated')
    ) INTO v_is_booked;

    IF NOT v_is_booked AND v_booked_count < v_quota THEN
      v_available_count := v_available_count + 1;
    END IF;

    v_slots := v_slots || jsonb_build_object(
      'time_str', to_char(v_slot_start, 'HH12:MI AM'),
      'scheduled_time', v_slot_start,
      'duration_mins', v_slot_duration,
      'buffer_mins', v_buffer,
      'is_booked', v_is_booked,
      'is_available', (NOT v_is_booked AND v_booked_count < v_quota),
      'is_past', (v_slot_start < now())
    );

    v_curr_time := (v_curr_time + ((v_slot_duration + v_buffer) || ' minutes')::INTERVAL)::TIME;
  END LOOP;

  RETURN jsonb_build_object(
    'is_holiday', false,
    'doctor_id', p_doctor_id,
    'date', p_date,
    'daily_quota', v_quota,
    'booked_count', v_booked_count,
    'available_count', v_available_count,
    'total_slots', v_total_slots,
    'slots', v_slots
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. ATOMIC RPC: BOOK APPOINTMENT WITH DOUBLE-BOOKING GUARD & SUGGESTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_appointment_guarded(
  p_doctor_id UUID,
  p_patient_id UUID,
  p_patient_name TEXT,
  p_phone TEXT,
  p_scheduled_time TIMESTAMPTZ,
  p_visit_type TEXT DEFAULT 'Walk-in',
  p_priority TEXT DEFAULT 'Normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'Asia/Kolkata'
AS $$
DECLARE
  v_collision_id UUID;
  v_next_token INT;
  v_new_appt_id UUID;
  v_alt_slots JSONB := '[]'::JSONB;
  v_date DATE;
  v_quota INT;
  v_current_count INT;
  v_resolved_patient_id UUID;
BEGIN
  v_date := p_scheduled_time::DATE;

  SELECT daily_quota INTO v_quota FROM public.doctors WHERE id = p_doctor_id;
  v_quota := COALESCE(v_quota, 35);

  SELECT COUNT(*) INTO v_current_count
  FROM public.appointments
  WHERE doctor_id = p_doctor_id 
    AND scheduled_time::DATE = v_date
    AND status NOT IN ('Cancelled', 'Reallocated');

  IF v_current_count >= v_quota THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'QUOTA_EXCEEDED',
      'message', 'Doctor daily patient quota limit reached (' || v_quota || ' patients).'
    );
  END IF;

  SELECT id INTO v_collision_id
  FROM public.appointments
  WHERE doctor_id = p_doctor_id 
    AND scheduled_time = p_scheduled_time
    AND status NOT IN ('Cancelled', 'Reallocated')
  FOR UPDATE SKIP LOCKED;

  IF v_collision_id IS NOT NULL THEN
    SELECT jsonb_agg(sub.time_label) INTO v_alt_slots
    FROM (
      SELECT to_char(slot_time, 'HH12:MI AM') as time_label
      FROM generate_series(
        (v_date::TEXT || ' 09:00:00')::TIMESTAMPTZ,
        (v_date::TEXT || ' 17:00:00')::TIMESTAMPTZ,
        '15 minutes'::INTERVAL
      ) AS slot_time
      WHERE slot_time > now()
        AND NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.doctor_id = p_doctor_id
            AND a.scheduled_time = slot_time
            AND a.status NOT IN ('Cancelled', 'Reallocated')
        )
      LIMIT 3
    ) sub;

    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DOUBLE_BOOKING_COLLISION',
      'message', 'Slot is already reserved by another patient.',
      'collided_time', p_scheduled_time,
      'recommended_slots', COALESCE(v_alt_slots, '[]'::JSONB)
    );
  END IF;

  -- Ensure patient record exists
  v_resolved_patient_id := p_patient_id;
  IF v_resolved_patient_id IS NULL AND p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    SELECT id INTO v_resolved_patient_id 
    FROM public.patients 
    WHERE phone = p_phone OR phone_number = p_phone 
    LIMIT 1;

    IF v_resolved_patient_id IS NULL THEN
      INSERT INTO public.patients (full_name, phone, phone_number, age, gender)
      VALUES (COALESCE(p_patient_name, 'Patient'), p_phone, p_phone, 30, 'Male')
      RETURNING id INTO v_resolved_patient_id;
    END IF;
  END IF;

  SELECT COALESCE(MAX(queue_token_no), 0) + 1 INTO v_next_token
  FROM public.appointments
  WHERE scheduled_time::DATE = v_date;

  INSERT INTO public.appointments (
    doctor_id,
    patient_id,
    scheduled_time,
    status,
    visit_type,
    priority,
    queue_token_no,
    booking_channel,
    created_at,
    updated_at
  ) VALUES (
    p_doctor_id,
    v_resolved_patient_id,
    p_scheduled_time,
    'Confirmed',
    p_visit_type,
    p_priority,
    v_next_token,
    COALESCE(p_visit_type, 'Walk-in'),
    now(),
    now()
  ) RETURNING id INTO v_new_appt_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_new_appt_id,
    'token_no', v_next_token,
    'scheduled_time', p_scheduled_time,
    'message', 'Appointment confirmed successfully with Token #' || v_next_token
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CONCURRENT_COLLISION',
      'message', 'Slot was just taken by another patient concurrently. Please select another slot.'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. ATOMIC RPC: GET ACTIVE QUEUE (STRICTLY EXCLUDES CANCELLED)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_queue_clean(
  p_doctor_id UUID DEFAULT NULL,
  p_date DATE DEFAULT current_date
)
RETURNS TABLE (
  appointment_id UUID,
  token_no INT,
  patient_name TEXT,
  phone TEXT,
  scheduled_time TIMESTAMPTZ,
  visit_type TEXT,
  status TEXT,
  priority TEXT,
  wait_time_mins INT,
  doctor_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET timezone = 'Asia/Kolkata'
AS $$
  SELECT 
    a.id as appointment_id,
    COALESCE(a.queue_token_no, 0) as token_no,
    COALESCE(p.full_name, 'Patient') as patient_name,
    COALESCE(p.phone, p.phone_number, '') as phone,
    a.scheduled_time,
    COALESCE(a.visit_type, 'Walk-in') as visit_type,
    a.status,
    COALESCE(a.priority, 'Normal') as priority,
    GREATEST(0, EXTRACT(EPOCH FROM (now() - a.scheduled_time))::INT / 60) as wait_time_mins,
    COALESCE(d.full_name, 'Doctor') as doctor_name
  FROM public.appointments a
  LEFT JOIN public.patients p ON a.patient_id = p.id
  LEFT JOIN public.doctors d ON a.doctor_id = d.id
  WHERE a.scheduled_time::DATE = p_date
    AND a.status NOT IN ('Cancelled', 'Reallocated')
    AND (p_doctor_id IS NULL OR a.doctor_id = p_doctor_id)
  ORDER BY 
    CASE 
      WHEN a.status = 'In Consultation' THEN 1
      WHEN a.status = 'Arrived' THEN 2
      WHEN a.status = 'Confirmed' THEN 3
      ELSE 4
    END ASC,
    a.queue_token_no ASC;
$$;

-- ----------------------------------------------------------------------------
-- 11. ATOMIC RPC: PATIENT COMPLETE MEDICAL HISTORY PROFILE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_patient_medical_history_profile(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'Asia/Kolkata'
AS $$
DECLARE
  v_patient RECORD;
  v_visits JSONB;
  v_medications JSONB;
BEGIN
  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Patient not found');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'appointment_id', a.id,
      'date', a.scheduled_time,
      'doctor_name', d.full_name,
      'specialization', d.specialization,
      'status', a.status,
      'clinical_notes', a.clinical_notes,
      'next_visit_date', a.next_visit_date,
      'consultation_duration_mins', a.consultation_duration_mins
    ) ORDER BY a.scheduled_time DESC
  ) INTO v_visits
  FROM public.appointments a
  LEFT JOIN public.doctors d ON a.doctor_id = d.id
  WHERE a.patient_id = p_patient_id
    AND a.status != 'Cancelled';

  SELECT jsonb_agg(
    jsonb_build_object(
      'medicine_name', COALESCE(pm.medicine_name, (SELECT brand_name FROM public.inventory WHERE id::text = pm.inventory_id::text LIMIT 1), 'Medicine'),
      'dosage', pm.dosage,
      'frequency', pm.frequency,
      'duration', pm.duration,
      'instructions', pm.instructions,
      'prescribed_date', pm.created_at
    ) ORDER BY pm.created_at DESC
  ) INTO v_medications
  FROM public.prescribed_medications pm
  JOIN public.appointments a ON pm.appointment_id = a.id
  WHERE a.patient_id = p_patient_id;

  RETURN jsonb_build_object(
    'success', true,
    'patient', jsonb_build_object(
      'id', v_patient.id,
      'full_name', v_patient.full_name,
      'phone', COALESCE(v_patient.phone, v_patient.phone_number, ''),
      'age', v_patient.age,
      'gender', v_patient.gender,
      'created_at', v_patient.created_at
    ),
    'visits', COALESCE(v_visits, '[]'::JSONB),
    'prescriptions', COALESCE(v_medications, '[]'::JSONB)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. ATOMIC RPC: CASE MIX & PHARMACY FINANCIAL VALUATION REPORT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_casemix_and_pharmacy_valuation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casemix JSONB := '[]'::JSONB;
  v_pharmacy_valuation JSONB := '{}'::JSONB;
  v_fast_moving JSONB := '[]'::JSONB;
BEGIN
  IF to_regclass('public.appointments') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('category', category, 'count', total_cases)
    ), '[]'::JSONB) INTO v_casemix
    FROM (
      SELECT 
        CASE 
          WHEN clinical_notes ILIKE '%fever%' OR clinical_notes ILIKE '%cold%' OR clinical_notes ILIKE '%cough%' THEN 'Viral / Respiratory'
          WHEN clinical_notes ILIKE '%diabetes%' OR clinical_notes ILIKE '%sugar%' THEN 'Endocrine / Diabetes'
          WHEN clinical_notes ILIKE '%hypertension%' OR clinical_notes ILIKE '%bp%' OR clinical_notes ILIKE '%cardiac%' THEN 'Cardiovascular'
          WHEN clinical_notes ILIKE '%gastric%' OR clinical_notes ILIKE '%acidity%' OR clinical_notes ILIKE '%pain%' THEN 'Gastrointestinal'
          ELSE 'General Consultation'
        END as category,
        COUNT(*) as total_cases
      FROM public.appointments
      WHERE status = 'Completed'
        AND clinical_notes IS NOT NULL AND length(trim(clinical_notes)) > 0
      GROUP BY 1
      ORDER BY total_cases DESC
      LIMIT 6
    ) sub;
  END IF;

  IF to_regclass('public.inventory') IS NOT NULL THEN
    SELECT jsonb_build_object(
      'total_skus', COALESCE(COUNT(*), 0),
      'total_units', COALESCE(SUM(stock_quantity), 0),
      'total_retail_value', COALESCE(SUM(stock_quantity * COALESCE(unit_price, 0)), 0),
      'low_stock_skus', COALESCE(COUNT(*) FILTER (WHERE stock_quantity <= COALESCE(reorder_threshold, 20)), 0)
    )
    INTO v_pharmacy_valuation
    FROM public.inventory;
  END IF;

  IF to_regclass('public.prescribed_medications') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('medicine_name', medicine_name, 'prescribed_count', cnt)
    ), '[]'::JSONB) INTO v_fast_moving
    FROM (
      SELECT COALESCE(medicine_name, 'Prescribed Medicine') as medicine_name, COUNT(*) as cnt
      FROM public.prescribed_medications
      WHERE medicine_name IS NOT NULL
      GROUP BY medicine_name
      ORDER BY cnt DESC
      LIMIT 5
    ) f;
  END IF;

  RETURN jsonb_build_object(
    'casemix', v_casemix,
    'pharmacy_valuation', v_pharmacy_valuation,
    'fast_moving_molecules', v_fast_moving
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. PERMISSIONS & SCHEMA RELOAD
-- ----------------------------------------------------------------------------
GRANT ALL ON TABLE public.doctors TO anon, authenticated;
GRANT ALL ON TABLE public.doctor_schedules TO anon, authenticated;
GRANT ALL ON TABLE public.daily_schedules TO anon, authenticated;
GRANT ALL ON TABLE public.generic_molecules TO anon, authenticated;
GRANT ALL ON TABLE public.inventory TO anon, authenticated;
GRANT ALL ON TABLE public.appointments TO anon, authenticated;
GRANT ALL ON TABLE public.patients TO anon, authenticated;
GRANT ALL ON TABLE public.prescribed_medications TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

