-- ════════════════════════════════════════════════════════════════════════════
-- FIX 42P01: REMOVE ALL REMAINING REFERENCES TO public.doctor_branch_assignments
-- Rewrites all branch-doctor, open-slot, booking-portal, and live-queue RPCs
-- to use public.doctors.location_id directly (and fixes PGRST203 overloads).
-- Safe & non-destructive: does NOT overwrite register_walk_in_patient.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Drop old signatures cleanly so there are no PGRST203 overloads
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname IN (
      'get_branch_doctors_for_slot',
      'get_branch_open_slots',
      'get_doctors_by_clinic',
      'resolve_booking_portal_by_slug',
      'admin_upsert_doctor_with_branches',
      'get_live_queue'
    )
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE;';
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC 1: get_branch_doctors_for_slot
-- Resolves active clinic/branch doctors directly via doctors.location_id
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_branch_doctors_for_slot(
  p_location_id    text,
  p_scheduled_time timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_clinic_id    uuid;
  v_branch_name  text;
  v_target_date  date;
  v_target_ts    timestamptz;
  v_doctors      jsonb := '[]'::jsonb;
BEGIN
  v_target_ts := COALESCE(p_scheduled_time, now());
  v_target_date := (v_target_ts AT TIME ZONE 'Asia/Kolkata')::date;

  SELECT loc.clinic_id, loc.branch_name
  INTO v_clinic_id, v_branch_name
  FROM public.clinic_locations loc
  WHERE loc.id::text = TRIM(COALESCE(p_location_id, ''))
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Branch location not found', 'doctors', '[]'::jsonb);
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',               d.id,
        'full_name',        d.full_name,
        'specialization',   COALESCE(d.specialization, 'General Medicine'),
        'consultation_fee', COALESCE(d.consultation_fee, 500),
        'daily_quota',      COALESCE(d.daily_quota, 40),
        'location_id',      d.location_id,
        'is_admin_doctor',  COALESCE(d.is_admin_doctor, false),
        'booked_today', (
          SELECT COUNT(*)::int
          FROM public.appointments a
          WHERE a.doctor_id = d.id
            AND (a.scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_target_date
            AND LOWER(a.status) NOT IN ('cancelled', 'reallocated')
        ),
        'slot_taken', EXISTS (
          SELECT 1
          FROM public.appointments a
          WHERE a.doctor_id = d.id
            AND a.scheduled_time = v_target_ts
            AND LOWER(a.status) NOT IN ('cancelled', 'reallocated')
        ),
        'available_spots', GREATEST(
          0,
          COALESCE(d.daily_quota, 40) - (
            SELECT COUNT(*)::int
            FROM public.appointments a
            WHERE a.doctor_id = d.id
              AND (a.scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_target_date
              AND LOWER(a.status) NOT IN ('cancelled', 'reallocated')
          )
        )
      )
      ORDER BY COALESCE(d.is_admin_doctor, false) DESC, d.full_name ASC
    ),
    '[]'::jsonb
  ) INTO v_doctors
  FROM public.doctors d
  WHERE d.clinic_id = v_clinic_id
    AND COALESCE(d.is_active, true) = true
    AND COALESCE(d.is_deleted, false) = false
    AND (
      d.location_id::text = TRIM(p_location_id)
      OR d.location_id IS NULL
      OR COALESCE(d.is_admin_doctor, false) = true
    );

  RETURN jsonb_build_object(
    'success',     true,
    'clinic_id',   v_clinic_id,
    'location_id', p_location_id,
    'branch_name', v_branch_name,
    'date',        v_target_date,
    'doctors',     v_doctors
  );
END;
$func$;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC 2: get_doctors_by_clinic
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_doctors_by_clinic(
  p_clinic_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_doctors jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',               d.id,
        'clinic_id',        d.clinic_id,
        'location_id',      d.location_id,
        'branch_name',      COALESCE(loc.branch_name, 'All Branches'),
        'branch_code',      COALESCE(loc.branch_code, 'ALL'),
        'full_name',        d.full_name,
        'specialization',   COALESCE(d.specialization, 'General Medicine'),
        'reg_no',           d.reg_no,
        'consultation_fee', COALESCE(d.consultation_fee, 500),
        'daily_quota',      COALESCE(d.daily_quota, 40),
        'phone',            d.phone,
        'is_admin_doctor',  COALESCE(d.is_admin_doctor, false),
        'is_active',        COALESCE(d.is_active, true)
      )
      ORDER BY COALESCE(d.is_admin_doctor, false) DESC, d.full_name ASC
    ),
    '[]'::jsonb
  ) INTO v_doctors
  FROM public.doctors d
  LEFT JOIN public.clinic_locations loc ON loc.id::text = d.location_id::text
  WHERE d.clinic_id = p_clinic_id
    AND COALESCE(d.is_active, true) = true
    AND COALESCE(d.is_deleted, false) = false;

  RETURN jsonb_build_object(
    'success',   true,
    'clinic_id', p_clinic_id,
    'doctors',   v_doctors
  );
END;
$func$;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC 3: get_branch_open_slots
-- Generates open slots cleanly using clinic_locations + doctors.location_id
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_branch_open_slots(
  p_location_id text,
  p_date        date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  p_doctor_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_clinic_id     uuid;
  v_branch_name   text;
  v_slot_mins     integer := 15;
  v_daily_quota   integer := 40;
  v_doc_id        uuid;
  v_doc_name      text;
  v_start_time    time := '09:00:00'::time;
  v_end_time      time := '18:00:00'::time;
  v_cur_ts        timestamptz;
  v_end_ts        timestamptz;
  v_slots         jsonb := '[]'::jsonb;
  v_is_booked     boolean;
  v_is_past       boolean;
BEGIN
  SELECT loc.clinic_id, loc.branch_name, COALESCE(loc.slot_duration_mins, 15), COALESCE(loc.daily_quota, 40)
  INTO v_clinic_id, v_branch_name, v_slot_mins, v_daily_quota
  FROM public.clinic_locations loc
  WHERE loc.id::text = TRIM(COALESCE(p_location_id, ''))
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Branch not found', 'slots', '[]'::jsonb);
  END IF;

  IF p_doctor_id IS NOT NULL THEN
    SELECT d.id, d.full_name, COALESCE(d.daily_quota, v_daily_quota)
    INTO v_doc_id, v_doc_name, v_daily_quota
    FROM public.doctors d
    WHERE d.id = p_doctor_id
      AND COALESCE(d.is_active, true) = true
      AND COALESCE(d.is_deleted, false) = false
    LIMIT 1;
  ELSE
    SELECT d.id, d.full_name, COALESCE(d.daily_quota, v_daily_quota)
    INTO v_doc_id, v_doc_name, v_daily_quota
    FROM public.doctors d
    WHERE d.clinic_id = v_clinic_id
      AND COALESCE(d.is_active, true) = true
      AND COALESCE(d.is_deleted, false) = false
      AND (
        d.location_id::text = TRIM(p_location_id)
        OR d.location_id IS NULL
        OR COALESCE(d.is_admin_doctor, false) = true
      )
    ORDER BY (d.location_id::text = TRIM(p_location_id)) DESC, COALESCE(d.is_admin_doctor, false) DESC, d.full_name ASC
    LIMIT 1;
  END IF;

  IF v_doc_id IS NOT NULL THEN
    SELECT
      COALESCE(ds.start_time, '09:00:00'::time),
      COALESCE(ds.end_time, '18:00:00'::time),
      COALESCE(ds.slot_duration_mins, v_slot_mins)
    INTO v_start_time, v_end_time, v_slot_mins
    FROM public.doctor_schedules ds
    WHERE ds.doctor_id = v_doc_id
      AND ds.day_of_week = EXTRACT(DOW FROM p_date)::int
      AND COALESCE(ds.is_active, true) = true
    LIMIT 1;
  END IF;

  v_cur_ts := ((p_date::text || ' ' || v_start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  v_end_ts := ((p_date::text || ' ' || v_end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');

  WHILE v_cur_ts < v_end_ts LOOP
    v_is_past := v_cur_ts < now();
    SELECT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE (v_doc_id IS NULL OR a.doctor_id = v_doc_id)
        AND (a.location_id::text = TRIM(p_location_id) OR a.location_id IS NULL)
        AND a.scheduled_time = v_cur_ts
        AND LOWER(a.status) NOT IN ('cancelled', 'reallocated')
    ) INTO v_is_booked;

    v_slots := v_slots || jsonb_build_array(
      jsonb_build_object(
        'time_str',       to_char(v_cur_ts AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM'),
        'scheduled_time', v_cur_ts,
        'duration_mins',  v_slot_mins,
        'is_booked',      v_is_booked,
        'is_past',        v_is_past,
        'is_available',   (NOT v_is_booked AND NOT v_is_past)
      )
    );
    v_cur_ts := v_cur_ts + make_interval(mins => GREATEST(5, v_slot_mins));
  END LOOP;

  RETURN jsonb_build_object(
    'success',     true,
    'location_id', p_location_id,
    'branch_name', v_branch_name,
    'doctor_id',   v_doc_id,
    'doctor_name', v_doc_name,
    'date',        p_date,
    'daily_quota', v_daily_quota,
    'slots',       v_slots
  );
END;
$func$;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC 4: resolve_booking_portal_by_slug
-- Uses public.clinics + public.clinic_locations + public.doctors.location_id
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_booking_portal_by_slug(
  p_clinic_slug text,
  p_branch_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_clinic   record;
  v_branch   record;
  v_doctors  jsonb := '[]'::jsonb;
BEGIN
  SELECT id, name, slug, phone, address, logo_url
  INTO v_clinic
  FROM public.clinics
  WHERE LOWER(COALESCE(slug, '')) = LOWER(TRIM(COALESCE(p_clinic_slug, '')))
     OR LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) = LOWER(TRIM(COALESCE(p_clinic_slug, '')))
     OR id::text = TRIM(COALESCE(p_clinic_slug, ''))
  LIMIT 1;

  IF v_clinic.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clinic portal not found');
  END IF;

  IF NULLIF(TRIM(COALESCE(p_branch_slug, '')), '') IS NOT NULL THEN
    SELECT *
    INTO v_branch
    FROM public.clinic_locations
    WHERE clinic_id = v_clinic.id
      AND COALESCE(is_active, true) = true
      AND (
        LOWER(COALESCE(branch_slug, '')) = LOWER(TRIM(p_branch_slug))
        OR LOWER(COALESCE(branch_code, '')) = LOWER(TRIM(p_branch_slug))
        OR LOWER(REGEXP_REPLACE(branch_name, '[^a-zA-Z0-9]+', '-', 'g')) = LOWER(TRIM(p_branch_slug))
        OR id::text = TRIM(p_branch_slug)
      )
    LIMIT 1;
  END IF;

  IF v_branch.id IS NULL THEN
    SELECT *
    INTO v_branch
    FROM public.clinic_locations
    WHERE clinic_id = v_clinic.id
      AND COALESCE(is_active, true) = true
    ORDER BY COALESCE(is_primary, false) DESC, created_at ASC
    LIMIT 1;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',               d.id,
        'full_name',        d.full_name,
        'specialization',   COALESCE(d.specialization, 'General Medicine'),
        'consultation_fee', COALESCE(d.consultation_fee, 500),
        'daily_quota',      COALESCE(d.daily_quota, 40),
        'location_id',      d.location_id,
        'is_admin_doctor',  COALESCE(d.is_admin_doctor, false)
      )
      ORDER BY COALESCE(d.is_admin_doctor, false) DESC, d.full_name ASC
    ),
    '[]'::jsonb
  ) INTO v_doctors
  FROM public.doctors d
  WHERE d.clinic_id = v_clinic.id
    AND COALESCE(d.is_active, true) = true
    AND COALESCE(d.is_deleted, false) = false
    AND (
      v_branch.id IS NULL
      OR d.location_id::text = v_branch.id::text
      OR d.location_id IS NULL
      OR COALESCE(d.is_admin_doctor, false) = true
    );

  RETURN jsonb_build_object(
    'success', true,
    'clinic', jsonb_build_object(
      'id',       v_clinic.id,
      'name',     v_clinic.name,
      'slug',     v_clinic.slug,
      'phone',    v_clinic.phone,
      'address',  v_clinic.address,
      'logo_url', v_clinic.logo_url
    ),
    'branch', CASE WHEN v_branch.id IS NOT NULL THEN jsonb_build_object(
      'id',                 v_branch.id,
      'branch_name',        v_branch.branch_name,
      'branch_code',        v_branch.branch_code,
      'branch_slug',        v_branch.branch_slug,
      'phone',              v_branch.phone,
      'address',            v_branch.address,
      'daily_quota',        COALESCE(v_branch.daily_quota, 40),
      'slot_duration_mins', COALESCE(v_branch.slot_duration_mins, 15)
    ) ELSE NULL END,
    'doctors', v_doctors
  );
END;
$func$;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC 5: admin_upsert_doctor_with_branches (Writes doctors.location_id directly)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_upsert_doctor_with_branches(
  p_doctor_id       uuid,
  p_clinic_id       uuid,
  p_full_name       text,
  p_specialization  text,
  p_reg_no          text,
  p_phone           text,
  p_daily_quota     integer,
  p_pin_code        text,
  p_is_admin_doctor boolean,
  p_is_active       boolean,
  p_branch_ids      text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_doc_id   uuid := COALESCE(p_doctor_id, gen_random_uuid());
  v_loc_id   text := NULL;
BEGIN
  IF p_branch_ids IS NOT NULL AND array_length(p_branch_ids, 1) >= 1 THEN
    v_loc_id := NULLIF(TRIM(p_branch_ids[1]), '');
  END IF;
  IF COALESCE(p_is_admin_doctor, false) THEN
    v_loc_id := NULL;
  END IF;

  INSERT INTO public.doctors (
    id, clinic_id, location_id, full_name, specialization, reg_no,
    phone, daily_quota, pin_code, is_admin_doctor, is_active, updated_at
  ) VALUES (
    v_doc_id, p_clinic_id, v_loc_id, TRIM(p_full_name), COALESCE(TRIM(p_specialization), 'General Medicine'),
    NULLIF(TRIM(COALESCE(p_reg_no, '')), ''), NULLIF(TRIM(COALESCE(p_phone, '')), ''),
    COALESCE(p_daily_quota, 40), TRIM(COALESCE(p_pin_code, '1234')),
    COALESCE(p_is_admin_doctor, false), COALESCE(p_is_active, true), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    location_id     = EXCLUDED.location_id,
    full_name       = EXCLUDED.full_name,
    specialization  = EXCLUDED.specialization,
    reg_no          = EXCLUDED.reg_no,
    phone           = EXCLUDED.phone,
    daily_quota     = EXCLUDED.daily_quota,
    pin_code        = EXCLUDED.pin_code,
    is_admin_doctor = EXCLUDED.is_admin_doctor,
    is_active       = EXCLUDED.is_active,
    updated_at      = now();

  RETURN jsonb_build_object('success', true, 'doctor_id', v_doc_id, 'location_id', v_loc_id);
END;
$func$;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC 6: get_live_queue (Single canonical signature fixes PGRST203 overload)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_live_queue(
  p_doctor_id   uuid DEFAULT NULL,
  p_date        date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  p_location_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'appointment_id', a.id,
        'patient_id',     a.patient_id,
        'doctor_id',      a.doctor_id,
        'location_id',    a.location_id,
        'token_no',       a.queue_token_no,
        'patient_name',   p.full_name,
        'phone',          COALESCE(p.phone_number, p.phone),
        'age',            p.age,
        'gender',         p.gender,
        'scheduled_time', a.scheduled_time,
        'visit_type',     COALESCE(a.visit_type, 'Walk-in'),
        'status',         a.status,
        'priority',       COALESCE(a.priority, 'Normal'),
        'doctor_name',    d.full_name
      )
      ORDER BY
        CASE LOWER(a.status) WHEN 'in progress' THEN 1 WHEN 'waiting' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END,
        a.queue_token_no ASC NULLS LAST,
        a.scheduled_time ASC
    ),
    '[]'::jsonb
  )
  FROM public.appointments a
  JOIN public.patients p ON p.id = a.patient_id
  LEFT JOIN public.doctors d ON d.id = a.doctor_id
  WHERE (p_doctor_id IS NULL OR a.doctor_id = p_doctor_id)
    AND (NULLIF(TRIM(COALESCE(p_location_id, '')), '') IS NULL OR a.location_id::text = TRIM(p_location_id))
    AND (a.scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = COALESCE(p_date, (now() AT TIME ZONE 'Asia/Kolkata')::date)
    AND LOWER(a.status) NOT IN ('cancelled', 'reallocated');
$$;

GRANT EXECUTE ON FUNCTION public.get_branch_doctors_for_slot(text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_doctors_by_clinic(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_open_slots(text, date, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_booking_portal_by_slug(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_doctor_with_branches(uuid, uuid, text, text, text, text, integer, text, boolean, boolean, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_queue(uuid, date, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
