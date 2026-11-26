-- ════════════════════════════════════════════════════════════════════════════
-- ALL-IN-ONE CLINICAL PATIENTS, WALK-IN & FULL MEDICAL HISTORY MIGRATION
-- Includes:
-- 1. Drop legacy phone-only constraints + broken inventory FK on prescribed_medications
-- 2. Add missing Rx columns & prescription_pdf_url on appointments
-- 3. Merge duplicate patient records & backfill missed Dispensings from stock_movements
-- 4. Unified register_walk_in_patient & get_patient_full_history (medicines + inventory + Rx PDFs)
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1: DROP LEGACY CONSTRAINTS & UPDATE SCHEMA COLUMNS
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_phone_number_key CASCADE;
DROP INDEX IF EXISTS public.patients_phone_number_key CASCADE;
DROP INDEX IF EXISTS public.idx_patients_phone_unique CASCADE;
DROP INDEX IF EXISTS public.idx_patients_phone_name_unique CASCADE;

CREATE UNIQUE INDEX idx_patients_phone_name_unique
ON public.patients (
  phone_number,
  LOWER(TRIM(full_name))
)
WHERE phone_number IS NOT NULL
  AND TRIM(phone_number) <> ''
  AND is_active = true;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS chk_visit_type CASCADE;
ALTER TABLE public.appointments ADD CONSTRAINT chk_visit_type
CHECK (visit_type IN (
  'Walk-in', 'walk-in', 'Walk-In', 'walkin',
  'WhatsApp Link', 'whatsapp', 'WhatsApp', 'Online WA', 'Online', 'online',
  'Emergency', 'emergency',
  'Follow-up', 'follow-up',
  'Routine', 'routine'
));

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check CASCADE;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
CHECK (status IN (
  'Waiting', 'waiting',
  'In Progress', 'in progress', 'in-progress',
  'Completed', 'completed',
  'Cancelled', 'cancelled',
  'Reallocated', 'reallocated',
  'Scheduled', 'scheduled'
));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS prescription_pdf_url text,
  ADD COLUMN IF NOT EXISTS custom_rx_data jsonb;

-- Ensure public 'prescriptions' Storage bucket exists for saving generated Custom Rx PDFs
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('prescriptions', 'prescriptions', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public upload prescriptions'
  ) THEN
    CREATE POLICY "Allow public upload prescriptions"
      ON storage.objects FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id = 'prescriptions');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public update prescriptions'
  ) THEN
    CREATE POLICY "Allow public update prescriptions"
      ON storage.objects FOR UPDATE TO anon, authenticated
      USING (bucket_id = 'prescriptions');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public read prescriptions'
  ) THEN
    CREATE POLICY "Allow public read prescriptions"
      ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'prescriptions');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Allow prescribed_medications to reference public.medicines IDs cleanly
ALTER TABLE public.prescribed_medications
  DROP CONSTRAINT IF EXISTS prescribed_medications_inventory_id_fkey CASCADE;

ALTER TABLE public.prescribed_medications
  ALTER COLUMN inventory_id DROP NOT NULL;

ALTER TABLE public.prescribed_medications
  ADD COLUMN IF NOT EXISTS medicine_id uuid,
  ADD COLUMN IF NOT EXISTS medicine_name text,
  ADD COLUMN IF NOT EXISTS dosage text,
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2: MERGE ANY EXISTING DUPLICATES & BACKFILL HISTORICAL DISPENSINGS
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_phone       text;
  v_name        text;
  v_keep_id     uuid;
  v_dup_id      uuid;
BEGIN
  FOR v_phone, v_name IN
    SELECT phone_number, LOWER(TRIM(full_name))
    FROM public.patients
    WHERE phone_number IS NOT NULL
      AND TRIM(phone_number) <> ''
      AND is_active = true
    GROUP BY phone_number, LOWER(TRIM(full_name))
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_keep_id
    FROM public.patients
    WHERE phone_number = v_phone
      AND LOWER(TRIM(full_name)) = v_name
      AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    FOR v_dup_id IN
      SELECT id
      FROM public.patients
      WHERE phone_number = v_phone
        AND LOWER(TRIM(full_name)) = v_name
        AND id <> v_keep_id
        AND is_active = true
    LOOP
      UPDATE public.appointments
      SET patient_id = v_keep_id, updated_at = now()
      WHERE patient_id = v_dup_id;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prescribed_medications'
          AND column_name = 'patient_id'
      ) THEN
        UPDATE public.prescribed_medications
        SET patient_id = v_keep_id
        WHERE patient_id = v_dup_id;
      END IF;

      UPDATE public.patients
      SET is_active = false, updated_at = now()
      WHERE id = v_dup_id;
    END LOOP;
  END LOOP;
END $$;

-- Backfill past dispensed medicines from stock_movements where prescribed_medications
-- failed to insert earlier due to legacy FK/column constraints
INSERT INTO public.prescribed_medications (
  appointment_id,
  inventory_id,
  medicine_id,
  medicine_name,
  dispensed_quantity,
  created_at
)
SELECT DISTINCT ON (a.id, sm.medicine_id, sm.id)
  a.id AS appointment_id,
  CASE
    WHEN sm.medicine_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN sm.medicine_id::uuid
    ELSE NULL
  END AS inventory_id,
  CASE
    WHEN sm.medicine_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN sm.medicine_id::uuid
    ELSE NULL
  END AS medicine_id,
  COALESCE(med.brand_name, med.generic_name, 'Prescribed Medicine') AS medicine_name,
  GREATEST(1, ABS(COALESCE(sm.quantity, 1))) AS dispensed_quantity,
  COALESCE(sm.date, sm.created_at, a.scheduled_time, now()) AS created_at
FROM public.stock_movements sm
LEFT JOIN public.medicine_batches mb ON mb.id::text = sm.batch_id::text
LEFT JOIN public.medicines med ON med.id::text = sm.medicine_id::text
JOIN public.appointments a
  ON a.queue_token_no IS NOT NULL
 AND UPPER(TRIM(sm.reference_number)) = UPPER('RX-P' || LPAD(a.queue_token_no::text, 3, '0'))
 AND (COALESCE(sm.date, sm.created_at) AT TIME ZONE 'Asia/Kolkata')::date = (a.scheduled_time AT TIME ZONE 'Asia/Kolkata')::date
 AND (mb.clinic_id IS NULL OR a.clinic_id = mb.clinic_id)
 AND (mb.location_id IS NULL OR a.location_id IS NULL OR a.location_id::text = mb.location_id::text)
WHERE LOWER(COALESCE(sm.movement_type, '')) = 'dispensing'
  AND NOT EXISTS (
    SELECT 1
    FROM public.prescribed_medications pm
    WHERE pm.appointment_id = a.id
      AND COALESCE(pm.medicine_id::text, pm.inventory_id::text, '') = sm.medicine_id::text
  );

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 3: register_walk_in_patient (SAME-DAY SAFE + NORMALIZED VISIT TYPE)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_func record;
BEGIN
  FOR v_func IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'register_walk_in_patient'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || v_func.sig || ' CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.register_walk_in_patient(
  p_clinic_id       uuid,
  p_location_id     text,
  p_doctor_id       uuid,
  p_full_name       text,
  p_phone_number    text,
  p_age             integer     DEFAULT NULL,
  p_gender          text        DEFAULT NULL,
  p_blood_group     text        DEFAULT NULL,
  p_visit_type      text        DEFAULT 'Walk-in',
  p_booking_channel text        DEFAULT 'Walk-in',
  p_priority        text        DEFAULT 'Normal',
  p_scheduled_time  timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id       uuid;
  v_appointment_id   uuid;
  v_token_no         integer;
  v_is_returning     boolean := false;
  v_total_visits     integer := 0;
  v_clean_phone      text;
  v_clean_name       text;
  v_sched_time       timestamptz;
  v_match_type       text := 'none';
  v_display_id       text;
  v_existing_apt_id  uuid;
  v_existing_token   integer;
  v_norm_visit_type  text;
  v_norm_channel     text;
BEGIN
  v_clean_phone := REGEXP_REPLACE(TRIM(COALESCE(p_phone_number, '')), '[^0-9]', '', 'g');
  v_clean_name  := LOWER(TRIM(COALESCE(p_full_name, '')));
  v_sched_time  := COALESCE(p_scheduled_time, now());

  IF LOWER(COALESCE(p_visit_type, '')) ILIKE '%what%' THEN
    v_norm_visit_type := 'WhatsApp Link';
  ELSIF LOWER(COALESCE(p_visit_type, '')) ILIKE '%emerg%' THEN
    v_norm_visit_type := 'Emergency';
  ELSIF LOWER(COALESCE(p_visit_type, '')) ILIKE '%follow%' THEN
    v_norm_visit_type := 'Follow-up';
  ELSE
    v_norm_visit_type := 'Walk-in';
  END IF;

  v_norm_channel := CASE
    WHEN LOWER(COALESCE(p_booking_channel, '')) ILIKE '%what%' THEN 'WhatsApp Link'
    ELSE 'Walk-in'
  END;

  IF LENGTH(v_clean_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid phone number. Minimum 10 digits required.');
  END IF;

  IF v_clean_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Patient name is required.');
  END IF;

  IF p_doctor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Doctor selection is required.');
  END IF;

  IF p_clinic_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clinic ID is required.');
  END IF;

  -- 1. Identify existing patient
  SELECT id, display_id INTO v_patient_id, v_display_id
  FROM public.patients
  WHERE (
    phone_number = v_clean_phone
    OR phone = v_clean_phone
    OR (LENGTH(v_clean_phone) >= 10 AND RIGHT(REGEXP_REPLACE(COALESCE(phone_number, ''), '[^0-9]', '', 'g'), 10) = RIGHT(v_clean_phone, 10))
    OR (LENGTH(v_clean_phone) >= 10 AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = RIGHT(v_clean_phone, 10))
  )
  AND LOWER(TRIM(full_name)) = v_clean_name
  AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_patient_id IS NOT NULL THEN
    v_is_returning := true;
    v_match_type   := 'same_person';

    UPDATE public.patients
    SET
      phone       = COALESCE(phone, v_clean_phone),
      age         = COALESCE(p_age, age),
      gender      = COALESCE(NULLIF(p_gender, ''), gender),
      blood_group = COALESCE(NULLIF(p_blood_group, ''), blood_group),
      updated_at  = now()
    WHERE id = v_patient_id;
  ELSE
    INSERT INTO public.patients (
      full_name,
      phone_number,
      phone,
      age,
      gender,
      blood_group,
      allergies_json,
      chronic_tags,
      is_vip,
      is_active
    ) VALUES (
      TRIM(p_full_name),
      v_clean_phone,
      v_clean_phone,
      p_age,
      p_gender,
      p_blood_group,
      '[]'::jsonb,
      ARRAY[]::text[],
      (COALESCE(p_priority, '') ILIKE '%vip%'),
      true
    )
    ON CONFLICT (phone_number, LOWER(TRIM(full_name))) WHERE phone_number IS NOT NULL AND TRIM(phone_number) <> '' AND is_active = true
    DO UPDATE SET
      phone       = EXCLUDED.phone,
      age         = COALESCE(EXCLUDED.age, patients.age),
      gender      = COALESCE(NULLIF(EXCLUDED.gender, ''), patients.gender),
      blood_group = COALESCE(NULLIF(EXCLUDED.blood_group, ''), patients.blood_group),
      updated_at  = now()
    RETURNING id, display_id INTO v_patient_id, v_display_id;

    IF EXISTS (
      SELECT 1 FROM public.patients
      WHERE (
        phone_number = v_clean_phone
        OR phone = v_clean_phone
        OR RIGHT(REGEXP_REPLACE(COALESCE(phone_number, ''), '[^0-9]', '', 'g'), 10) = RIGHT(v_clean_phone, 10)
      )
      AND id <> v_patient_id
      AND is_active = true
    ) THEN
      v_match_type := 'family_member';
    ELSE
      v_match_type := 'new_patient';
    END IF;
  END IF;

  -- 2. Check if already waiting in queue today for this doctor
  SELECT id, queue_token_no INTO v_existing_apt_id, v_existing_token
  FROM public.appointments
  WHERE patient_id = v_patient_id
    AND doctor_id = p_doctor_id
    AND (scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = (v_sched_time AT TIME ZONE 'Asia/Kolkata')::date
    AND LOWER(status) IN ('waiting', 'in progress', 'in-progress')
  ORDER BY scheduled_time DESC
  LIMIT 1;

  IF v_existing_apt_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_visits FROM public.appointments WHERE patient_id = v_patient_id;
    RETURN jsonb_build_object(
      'success',              true,
      'patient_id',           v_patient_id,
      'display_id',           COALESCE(v_display_id, lpad((SELECT patient_number FROM public.patients WHERE id = v_patient_id)::text, 3, '0')),
      'appointment_id',       v_existing_apt_id,
      'token_number',         v_existing_token,
      'is_returning_patient', true,
      'already_in_queue',     true,
      'total_visits',         v_total_visits,
      'match_type',           'already_waiting',
      'message',              'Patient ' || TRIM(p_full_name) || ' is already waiting in queue today with Token P' || LPAD(v_existing_token::text, 3, '0') || '.'
    );
  END IF;

  -- 3. Prevent double-booking slot collision
  WHILE EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id = p_doctor_id
      AND scheduled_time = v_sched_time
      AND LOWER(status) NOT IN ('cancelled', 'reallocated')
  ) LOOP
    v_sched_time := v_sched_time + interval '1 minute';
  END LOOP;

  -- 4. Sequential token
  SELECT COALESCE(MAX(queue_token_no), 0) + 1 INTO v_token_no
  FROM public.appointments
  WHERE doctor_id = p_doctor_id
    AND (p_location_id IS NULL OR location_id::text = p_location_id::text)
    AND (scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = (v_sched_time AT TIME ZONE 'Asia/Kolkata')::date
    AND LOWER(status) NOT IN ('cancelled', 'reallocated');

  -- 5. Insert appointment
  INSERT INTO public.appointments (
    patient_id,
    doctor_id,
    clinic_id,
    location_id,
    scheduled_time,
    status,
    visit_type,
    booking_channel,
    priority,
    queue_token_no
  ) VALUES (
    v_patient_id,
    p_doctor_id,
    p_clinic_id,
    p_location_id,
    v_sched_time,
    'Waiting',
    v_norm_visit_type,
    v_norm_channel,
    COALESCE(p_priority, 'Normal'),
    v_token_no
  )
  RETURNING id INTO v_appointment_id;

  SELECT COUNT(*) INTO v_total_visits
  FROM public.appointments
  WHERE patient_id = v_patient_id;

  RETURN jsonb_build_object(
    'success',              true,
    'patient_id',           v_patient_id,
    'display_id',           COALESCE(v_display_id, lpad((SELECT patient_number FROM public.patients WHERE id = v_patient_id)::text, 3, '0')),
    'appointment_id',       v_appointment_id,
    'token_number',         v_token_no,
    'is_returning_patient', v_is_returning,
    'already_in_queue',     false,
    'total_visits',         v_total_visits,
    'match_type',           v_match_type,
    'message', CASE
      WHEN v_is_returning
        THEN 'Welcome back ' || TRIM(p_full_name) || '! Token ' || v_token_no || ' assigned. Visit #' || v_total_visits
      WHEN v_match_type = 'family_member'
        THEN 'New family member registered: ' || TRIM(p_full_name) || '. Token ' || v_token_no || ' assigned.'
      ELSE
        'New patient registered: ' || TRIM(p_full_name) || '. Token ' || v_token_no || ' assigned.'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 4: get_patient_full_history (VISITS + MEDICINES + INVENTORY + SAVED RX PDFS)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_patient_full_history(
  p_search_query text,
  p_clinic_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id        uuid;
  v_patient           jsonb;
  v_display_id        text;
  v_clean_phone       text;
  v_past_visits       jsonb := '[]'::jsonb;
  v_upcoming          jsonb := '[]'::jsonb;
  v_all_past_rx       jsonb := '[]'::jsonb;
  v_storage_pdfs      jsonb := '[]'::jsonb;
  v_all_pdfs          jsonb := '[]'::jsonb;
  v_clean_query       text;
  v_search_phone      text;
  v_total_past_visits integer := 0;
BEGIN
  v_clean_query  := TRIM(COALESCE(p_search_query, ''));
  v_search_phone := REGEXP_REPLACE(v_clean_query, '[^0-9]', '', 'g');

  IF v_clean_query = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Search query cannot be empty.');
  END IF;

  SELECT
    p.id,
    COALESCE(p.display_id, lpad((p.patient_number)::text, 3, '0')),
    REGEXP_REPLACE(COALESCE(p.phone_number, p.phone, ''), '[^0-9]', '', 'g'),
    jsonb_build_object(
      'id',             p.id,
      'full_name',      p.full_name,
      'phone_number',   COALESCE(p.phone_number, p.phone),
      'age',            p.age,
      'gender',         p.gender,
      'blood_group',    p.blood_group,
      'allergies',      COALESCE(p.allergies_json, '[]'::jsonb),
      'chronic_tags',   COALESCE(p.chronic_tags, ARRAY[]::text[]),
      'is_vip',         COALESCE(p.is_vip, false),
      'display_id',     COALESCE(p.display_id, lpad((p.patient_number)::text, 3, '0')),
      'patient_number', p.patient_number,
      'member_since',   to_char(p.created_at, 'DD/MM/YYYY')
    )
  INTO v_patient_id, v_display_id, v_clean_phone, v_patient
  FROM public.patients p
  WHERE p.is_active = true
    AND (
      (LENGTH(v_search_phone) >= 10 AND (
        p.phone_number = v_search_phone
        OR p.phone = v_search_phone
        OR RIGHT(REGEXP_REPLACE(COALESCE(p.phone_number, ''), '[^0-9]', '', 'g'), 10) = RIGHT(v_search_phone, 10)
        OR RIGHT(REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g'), 10) = RIGHT(v_search_phone, 10)
      ))
      OR p.full_name  ILIKE '%' || v_clean_query || '%'
      OR p.display_id ILIKE '%' || v_clean_query || '%'
      OR ('P' || COALESCE(p.display_id, '')) ILIKE '%' || v_clean_query || '%'
      OR p.id::text = v_clean_query
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No patient record found matching: ' || v_clean_query);
  END IF;

  -- Scan 'prescriptions' bucket in Supabase Storage
  BEGIN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'file_name',  obj.name,
          'bucket_id',  obj.bucket_id,
          'created_at', obj.created_at
        )
        ORDER BY obj.created_at DESC
      ),
      '[]'::jsonb
    )
    INTO v_storage_pdfs
    FROM storage.objects obj
    WHERE obj.bucket_id = 'prescriptions'
      AND (
        obj.name ILIKE '%' || v_patient_id::text || '%'
        OR (v_display_id IS NOT NULL AND v_display_id <> '' AND obj.name ILIKE '%' || v_display_id || '%')
        OR (LENGTH(v_clean_phone) >= 10 AND obj.name ILIKE '%' || RIGHT(v_clean_phone, 10) || '%')
        OR EXISTS (
          SELECT 1
          FROM public.appointments ap
          WHERE ap.patient_id = v_patient_id
            AND obj.name ILIKE '%' || ap.id::text || '%'
        )
      );
  EXCEPTION WHEN OTHERS THEN
    v_storage_pdfs := '[]'::jsonb;
  END;

  -- Previous Clinical Visits
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'appointment_id',        a.id,
          'visit_date',            to_char(a.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY'),
          'slot_time',             to_char(a.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'),
          'token_number',          COALESCE(format('P%s', to_char(a.queue_token_no, 'FM000')), '--'),
          'status',                a.status,
          'visit_type',            COALESCE(a.visit_type, 'Walk-in'),
          'booking_channel',       COALESCE(to_jsonb(a)->>'booking_channel', a.visit_type, 'Walk-in'),
          'priority',              a.priority,
          'clinic_name',           COALESCE(c.name, 'Clinic'),
          'branch_name',           COALESCE(loc.branch_name, 'All Branches'),
          'doctor_name',           COALESCE(d.full_name, 'Consultant Physician'),
          'doctor_specialization', COALESCE(d.specialization, 'General Medicine'),
          'consultation_fee',      d.consultation_fee,
          'clinical_notes',        COALESCE(NULLIF(TRIM(a.clinical_notes), ''), 'Routine consultation'),
          'started_at',            a.started_at,
          'completed_at',          a.completed_at,
          'duration_mins',         a.consultation_duration_mins,
          'next_visit_date',       a.next_visit_date,
          'custom_rx_data',        to_jsonb(a)->'custom_rx_data',
          'prescription_pdf_url',  COALESCE(
            NULLIF(a.prescription_pdf_url, ''),
            NULLIF(to_jsonb(a)->>'rx_pdf_url', ''),
            NULLIF(to_jsonb(a)->>'pdf_url', ''),
            NULLIF(to_jsonb(a)->>'prescription_url', ''),
            (
              SELECT pf->>'file_name'
              FROM jsonb_array_elements(v_storage_pdfs) pf
              WHERE (pf->>'file_name') ILIKE '%' || a.id::text || '%'
              LIMIT 1
            )
          ),
          'prescriptions',         COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', pm.id,
                'medicine_name', COALESCE(
                  NULLIF(to_jsonb(pm)->>'medicine_name', ''),
                  med.brand_name,
                  med.generic_name,
                  to_jsonb(inv)->>'brand_name',
                  to_jsonb(inv)->>'name',
                  to_jsonb(inv)->>'generic_name',
                  to_jsonb(inv)->>'item_name',
                  'Prescribed Medicine #' || SUBSTRING(pm.id::text, 1, 6)
                ),
                'dispensed_quantity', pm.dispensed_quantity,
                'dosage',             COALESCE(to_jsonb(pm)->>'dosage', ''),
                'frequency',          COALESCE(to_jsonb(pm)->>'frequency', ''),
                'duration',           COALESCE(to_jsonb(pm)->>'duration', ''),
                'instructions',       COALESCE(to_jsonb(pm)->>'instructions', '')
              )
            )
            FROM public.prescribed_medications pm
            LEFT JOIN public.medicines med
              ON med.id::text = COALESCE(NULLIF(to_jsonb(pm)->>'medicine_id', ''), pm.inventory_id::text)
            LEFT JOIN public.inventory inv ON inv.id::text = pm.inventory_id::text
            WHERE pm.appointment_id = a.id
          ), '[]'::jsonb)
        )
        ORDER BY a.scheduled_time DESC
      ),
      '[]'::jsonb
    ),
    COUNT(a.id)
  INTO v_past_visits, v_total_past_visits
  FROM public.appointments a
  LEFT JOIN public.doctors d  ON d.id = a.doctor_id
  LEFT JOIN public.clinics c  ON c.id = a.clinic_id
  LEFT JOIN public.clinic_locations loc ON loc.id::text = a.location_id::text
  WHERE a.patient_id = v_patient_id
    AND LOWER(a.status) IN ('completed', 'cancelled', 'in-progress', 'in progress')
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id);

  -- Combine PDFs from appointments.prescription_pdf_url + storage.objects
  SELECT COALESCE(
    jsonb_agg(pdf_row ORDER BY pdf_row->>'created_at' DESC),
    '[]'::jsonb
  )
  INTO v_all_pdfs
  FROM (
    SELECT DISTINCT ON (file_path)
      jsonb_build_object(
        'file_name',      file_path,
        'appointment_id', apt_id,
        'visit_date',     v_date,
        'doctor_name',    doc_name,
        'created_at',     created_ts
      ) AS pdf_row
    FROM (
      SELECT
        COALESCE(
          NULLIF(a.prescription_pdf_url, ''),
          NULLIF(to_jsonb(a)->>'rx_pdf_url', ''),
          NULLIF(to_jsonb(a)->>'pdf_url', ''),
          NULLIF(to_jsonb(a)->>'prescription_url', '')
        ) AS file_path,
        a.id::text AS apt_id,
        to_char(a.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY') AS v_date,
        d.full_name AS doc_name,
        COALESCE(a.completed_at, a.scheduled_time)::text AS created_ts
      FROM public.appointments a
      LEFT JOIN public.doctors d ON d.id = a.doctor_id
      WHERE a.patient_id = v_patient_id
        AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
        AND COALESCE(
          NULLIF(a.prescription_pdf_url, ''),
          NULLIF(to_jsonb(a)->>'rx_pdf_url', ''),
          NULLIF(to_jsonb(a)->>'pdf_url', ''),
          NULLIF(to_jsonb(a)->>'prescription_url', '')
        ) IS NOT NULL
      UNION ALL
      SELECT
        pf->>'file_name' AS file_path,
        NULL::text AS apt_id,
        to_char(((pf->>'created_at')::timestamptz AT TIME ZONE 'Asia/Kolkata'), 'DD Mon YYYY') AS v_date,
        NULL::text AS doc_name,
        pf->>'created_at' AS created_ts
      FROM jsonb_array_elements(v_storage_pdfs) pf
    ) combined
    WHERE file_path IS NOT NULL AND file_path <> ''
    ORDER BY file_path, created_ts DESC
  ) deduped;

  -- All Past Prescribed Medications
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'medicine_name', COALESCE(
          NULLIF(to_jsonb(pm)->>'medicine_name', ''),
          med.brand_name,
          med.generic_name,
          to_jsonb(inv)->>'brand_name',
          to_jsonb(inv)->>'name',
          to_jsonb(inv)->>'generic_name',
          to_jsonb(inv)->>'item_name',
          'Medicine #' || SUBSTRING(pm.id::text, 1, 6)
        ),
        'dispensed_quantity', pm.dispensed_quantity,
        'dosage',             COALESCE(to_jsonb(pm)->>'dosage', ''),
        'frequency',          COALESCE(to_jsonb(pm)->>'frequency', ''),
        'duration',           COALESCE(to_jsonb(pm)->>'duration', ''),
        'instructions',       COALESCE(to_jsonb(pm)->>'instructions', ''),
        'prescribed_date',    to_char(a.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY'),
        'doctor_name',        COALESCE(d.full_name, 'Consultant Physician'),
        'appointment_id',     a.id
      )
      ORDER BY a.scheduled_time DESC
    ),
    '[]'::jsonb
  ) INTO v_all_past_rx
  FROM public.prescribed_medications pm
  JOIN public.appointments a ON a.id = pm.appointment_id
  LEFT JOIN public.doctors d ON d.id = a.doctor_id
  LEFT JOIN public.medicines med
    ON med.id::text = COALESCE(NULLIF(to_jsonb(pm)->>'medicine_id', ''), pm.inventory_id::text)
  LEFT JOIN public.inventory inv ON inv.id::text = pm.inventory_id::text
  WHERE a.patient_id = v_patient_id
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id);

  -- Fallback to prescription_details view ONLY when actual medication columns exist/non-null
  IF jsonb_array_length(v_all_past_rx) = 0 AND to_regclass('public.prescription_details') IS NOT NULL THEN
    BEGIN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'medicine_name', COALESCE(
              NULLIF(to_jsonb(pd)->>'medicine_name', ''),
              NULLIF(to_jsonb(pd)->>'brand_name', ''),
              NULLIF(to_jsonb(pd)->>'name', ''),
              NULLIF(to_jsonb(pd)->>'generic_name', ''),
              NULLIF(to_jsonb(pd)->>'generic_molecule', ''),
              'Prescribed Medicine'
            ),
            'dispensed_quantity', COALESCE((to_jsonb(pd)->>'dispensed_quantity')::integer, (to_jsonb(pd)->>'quantity')::integer, 1),
            'dosage',             COALESCE(to_jsonb(pd)->>'dosage', ''),
            'frequency',          COALESCE(to_jsonb(pd)->>'frequency', ''),
            'duration',           COALESCE(to_jsonb(pd)->>'duration', ''),
            'instructions',       COALESCE(to_jsonb(pd)->>'instructions', ''),
            'prescribed_date',    COALESCE(
              NULLIF(to_jsonb(pd)->>'prescribed_date', ''),
              to_char(a.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY')
            ),
            'doctor_name',        COALESCE(NULLIF(to_jsonb(pd)->>'doctor_name', ''), d.full_name),
            'appointment_id',     a.id
          )
          ORDER BY a.scheduled_time DESC
        ),
        '[]'::jsonb
      ) INTO v_all_past_rx
      FROM public.prescription_details pd
      JOIN public.appointments a ON a.id::text = COALESCE(to_jsonb(pd)->>'appointment_id', '')
      LEFT JOIN public.doctors d ON d.id = a.doctor_id
      WHERE a.patient_id = v_patient_id
        AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
        AND (
          NULLIF(to_jsonb(pd)->>'medicine_name', '') IS NOT NULL
          OR NULLIF(to_jsonb(pd)->>'brand_name', '') IS NOT NULL
          OR NULLIF(to_jsonb(pd)->>'name', '') IS NOT NULL
          OR NULLIF(to_jsonb(pd)->>'generic_name', '') IS NOT NULL
          OR NULLIF(to_jsonb(pd)->>'generic_molecule', '') IS NOT NULL
          OR (to_jsonb(pd)->>'dispensed_quantity') IS NOT NULL
          OR (to_jsonb(pd)->>'quantity') IS NOT NULL
        );
    EXCEPTION WHEN OTHERS THEN
      v_all_past_rx := '[]'::jsonb;
    END;
  END IF;

  -- Upcoming / Active Visits
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'appointment_id', a.id,
        'visit_date',     to_char(a.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY'),
        'slot_time',      to_char(a.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'),
        'token_number',   COALESCE(format('P%s', to_char(a.queue_token_no, 'FM000')), '--'),
        'status',         a.status,
        'doctor_name',    COALESCE(d.full_name, 'Consultant Physician'),
        'branch_name',    COALESCE(loc.branch_name, 'All Branches')
      )
      ORDER BY a.scheduled_time ASC
    ),
    '[]'::jsonb
  ) INTO v_upcoming
  FROM public.appointments a
  LEFT JOIN public.doctors d  ON d.id = a.doctor_id
  LEFT JOIN public.clinics c  ON c.id = a.clinic_id
  LEFT JOIN public.clinic_locations loc ON loc.id::text = a.location_id::text
  WHERE a.patient_id = v_patient_id
    AND LOWER(a.status) IN ('waiting', 'scheduled')
    AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id);

  RETURN jsonb_build_object(
    'success',                   true,
    'patient',                   v_patient,
    'total_visits',              (v_total_past_visits + jsonb_array_length(v_upcoming)),
    'total_past_visits',         v_total_past_visits,
    'previous_clinical_visits',  v_past_visits,
    'past_prescriptions',        v_all_past_rx,
    'prescription_pdfs',         v_all_pdfs,
    'upcoming_visits',           v_upcoming
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_walk_in_patient(uuid, text, uuid, text, text, integer, text, text, text, text, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_full_history(text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
