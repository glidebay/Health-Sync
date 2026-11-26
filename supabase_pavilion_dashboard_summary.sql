-- ════════════════════════════════════════════════════════════════════════════
-- UNIFIED get_pavilion_dashboard_summary RPC (Fixes PGRST203 Overload)
-- Drops any conflicting overloads and installs the single canonical function.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'get_pavilion_dashboard_summary'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.func_sig || ' CASCADE;';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_pavilion_dashboard_summary(
  p_clinic_id         text DEFAULT NULL,
  p_location_id       text DEFAULT NULL,
  p_doctor_id         uuid DEFAULT NULL,
  p_logged_doctor_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
#variable_conflict use_column
DECLARE
  v_today DATE;
  v_yesterday DATE;
  v_year_start TIMESTAMPTZ;

  v_eff_clinic_id text;
  v_eff_location_id text;
  v_eff_doctor_id uuid;
  v_is_admin boolean := false;

  -- Capacity & Configuration
  v_daily_quota integer := 40;
  v_slot_duration integer := 15;
  v_quota_used_pct numeric := 0.0;

  -- Top KPI Cards
  v_today_patients INTEGER := 0;
  v_yesterday_patients INTEGER := 0;
  v_patient_growth_pct NUMERIC := 0.0;
  v_patient_growth_label TEXT := '0% today';

  v_completed_consults INTEGER := 0;
  v_cancelled_consults INTEGER := 0;
  v_completion_rate TEXT := '0% rate';
  v_waiting_queue INTEGER := 0;
  v_pharmacy_stock BIGINT := 0;

  -- Chamber Telemetry
  v_active_token TEXT := '--';
  v_lounge_status TEXT := 'Waiting Lounge Clear';
  v_header_title TEXT := 'Clinic Overview';

  -- Today's Channel Split & Peak Metrics
  v_today_walkin INTEGER := 0;
  v_today_whatsapp INTEGER := 0;
  v_today_whatsapp_pct NUMERIC := 0.0;
  v_peak_hour_label TEXT := '11 AM';
  v_peak_hour_count INTEGER := 0;
  v_clinical_subtitle TEXT := '';
  v_intake_growth_label TEXT := '';

  -- Hourly Activity (9 AM - 6 PM)
  v_activity_bars JSONB := '[]'::jsonb;
  v_max_hour_count INTEGER := 1;

  -- 7-Day Intake Trend
  v_intake_series JSONB := '[]'::jsonb;
  v_max_daily_intake INTEGER := 1;

  -- Queue & Feed
  v_queue_list JSONB := '[]'::jsonb;
  v_activity_list JSONB := '[]'::jsonb;
  v_doctors_in_chamber JSONB := '[]'::jsonb;
BEGIN
  -- 1. Determine Scope
  v_eff_clinic_id := NULLIF(TRIM(COALESCE(p_clinic_id, '')), '');
  IF TRIM(COALESCE(p_location_id, '')) IN ('', 'ALL', 'all') THEN
    v_eff_location_id := NULL;
  ELSE
    v_eff_location_id := TRIM(p_location_id);
  END IF;
  v_eff_doctor_id := p_doctor_id;

  IF v_eff_location_id IS NULL AND v_eff_doctor_id IS NULL THEN
    v_is_admin := true;
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_yesterday := v_today - interval '1 day';
  v_year_start := date_trunc('year', now() AT TIME ZONE 'Asia/Kolkata');

  -- Header Title & Branch Quota/Slot config
  IF v_eff_doctor_id IS NOT NULL THEN
    SELECT COALESCE(d.full_name, 'Doctor'), COALESCE(d.daily_quota, 40)
    INTO v_header_title, v_daily_quota
    FROM public.doctors d WHERE d.id = v_eff_doctor_id LIMIT 1;
  ELSIF v_eff_location_id IS NOT NULL THEN
    SELECT 
      COALESCE(loc.branch_name, 'Branch Overview'),
      COALESCE(loc.daily_quota, 40),
      COALESCE(loc.slot_duration_mins, 15)
    INTO v_header_title, v_daily_quota, v_slot_duration
    FROM public.clinic_locations loc WHERE loc.id::text = v_eff_location_id LIMIT 1;
  ELSE
    SELECT COALESCE(c.name, 'Clinic Overall') INTO v_header_title
    FROM public.clinics c WHERE c.id::text = v_eff_clinic_id LIMIT 1;
    v_daily_quota := 200;
  END IF;

  -- 2. Top KPI Cards (Today vs Yesterday)
  SELECT count(*) INTO v_today_patients
  FROM public.appointments
  WHERE (v_eff_clinic_id IS NULL OR clinic_id::text = v_eff_clinic_id)
    AND (v_eff_location_id IS NULL OR location_id::text = v_eff_location_id)
    AND (v_eff_doctor_id IS NULL OR doctor_id = v_eff_doctor_id)
    AND (scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_today
    AND LOWER(status) NOT IN ('cancelled', 'reallocated');

  SELECT count(*) INTO v_yesterday_patients
  FROM public.appointments
  WHERE (v_eff_clinic_id IS NULL OR clinic_id::text = v_eff_clinic_id)
    AND (v_eff_location_id IS NULL OR location_id::text = v_eff_location_id)
    AND (v_eff_doctor_id IS NULL OR doctor_id = v_eff_doctor_id)
    AND (scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_yesterday
    AND LOWER(status) NOT IN ('cancelled', 'reallocated');

  IF v_yesterday_patients > 0 THEN
    v_patient_growth_pct := round(((v_today_patients - v_yesterday_patients)::numeric / v_yesterday_patients::numeric) * 100, 1);
    v_patient_growth_label := format('%s%s%% today', CASE WHEN v_patient_growth_pct >= 0 THEN '+' ELSE '' END, v_patient_growth_pct);
  ELSIF v_today_patients > 0 THEN
    v_patient_growth_label := '+100% today';
  ELSE
    v_patient_growth_label := '0% today';
  END IF;

  IF v_daily_quota > 0 THEN
    v_quota_used_pct := LEAST(100.0, round((v_today_patients::numeric / v_daily_quota::numeric) * 100, 1));
  END IF;

  -- 3. Completed, Cancelled, & Waiting
  SELECT
    count(*) FILTER (WHERE LOWER(status) = 'completed'),
    count(*) FILTER (WHERE LOWER(status) IN ('cancelled', 'reallocated')),
    count(*) FILTER (WHERE LOWER(status) IN ('waiting', 'in progress', 'in-progress')),
    count(*) FILTER (WHERE LOWER(COALESCE(booking_channel, visit_type, '')) ILIKE '%walk%'),
    count(*) FILTER (WHERE LOWER(COALESCE(booking_channel, visit_type, '')) ILIKE '%whatsapp%')
  INTO 
    v_completed_consults, 
    v_cancelled_consults, 
    v_waiting_queue,
    v_today_walkin,
    v_today_whatsapp
  FROM public.appointments
  WHERE (v_eff_clinic_id IS NULL OR clinic_id::text = v_eff_clinic_id)
    AND (v_eff_location_id IS NULL OR location_id::text = v_eff_location_id)
    AND (v_eff_doctor_id IS NULL OR doctor_id = v_eff_doctor_id)
    AND (scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_today;

  IF v_today_patients > 0 THEN
    v_completion_rate := format('%s%% rate', round((v_completed_consults::numeric / v_today_patients::numeric) * 100));
    v_today_whatsapp_pct := round((v_today_whatsapp::numeric / v_today_patients::numeric) * 100, 1);
  ELSE
    v_completion_rate := '0% rate';
  END IF;

  -- 4. Active Branch Pharmacy Stock
  BEGIN
    SELECT COALESCE(sum(stock_quantity), 0) INTO v_pharmacy_stock
    FROM public.inventory
    WHERE (v_eff_clinic_id IS NULL OR clinic_id::text = v_eff_clinic_id)
      AND (v_eff_location_id IS NULL OR location_id::text = v_eff_location_id);
  EXCEPTION WHEN OTHERS THEN
    v_pharmacy_stock := 0;
  END;

  -- 5. Chamber Telemetry
  SELECT
    COALESCE(format('P%s', to_char(a.queue_token_no, 'FM000')), '--'),
    format('In Chamber: %s', p.full_name)
  INTO v_active_token, v_lounge_status
  FROM public.appointments a
  JOIN public.patients p ON a.patient_id = p.id
  WHERE (v_eff_clinic_id IS NULL OR a.clinic_id::text = v_eff_clinic_id)
    AND (v_eff_location_id IS NULL OR a.location_id::text = v_eff_location_id)
    AND (v_eff_doctor_id IS NULL OR a.doctor_id = v_eff_doctor_id)
    AND (a.scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_today
    AND LOWER(a.status) IN ('in progress', 'in-progress')
  ORDER BY a.started_at DESC NULLS LAST, a.scheduled_time ASC
  LIMIT 1;

  IF v_active_token = '--' THEN
    IF v_waiting_queue > 0 THEN
      v_lounge_status := format('%s Patient(s) Waiting in Lounge', v_waiting_queue);
    ELSE
      v_lounge_status := 'Waiting Lounge Clear';
    END IF;
  END IF;

  -- 6. LEFT CARD: Hourly Load (9 AM - 6 PM)
  WITH counts AS (
    SELECT 
      extract(hour FROM (scheduled_time AT TIME ZONE 'Asia/Kolkata'))::integer AS hr, 
      count(*) AS cnt
    FROM public.appointments
    WHERE (v_eff_clinic_id IS NULL OR clinic_id::text = v_eff_clinic_id)
      AND (v_eff_location_id IS NULL OR location_id::text = v_eff_location_id)
      AND (v_eff_doctor_id IS NULL OR doctor_id = v_eff_doctor_id)
      AND (scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_today
      AND LOWER(status) NOT IN ('cancelled', 'reallocated')
    GROUP BY 1
  )
  SELECT 
    GREATEST(COALESCE(max(c.cnt), 1), 1),
    COALESCE(max(c.cnt), 0),
    COALESCE(to_char(to_timestamp((SELECT hr FROM counts ORDER BY cnt DESC LIMIT 1)::text, 'HH24'), 'HH12 AM'), '11 AM')
  INTO 
    v_max_hour_count,
    v_peak_hour_count,
    v_peak_hour_label
  FROM counts c;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'hour', CASE WHEN hs.hr < 12 THEN format('%s AM', hs.hr) WHEN hs.hr = 12 THEN '12 PM' ELSE format('%s PM', hs.hr - 12) END,
      'hour_num', hs.hr,
      'count', COALESCE(c.cnt, 0),
      'height', GREATEST(12, LEAST(100, round((COALESCE(c.cnt, 0)::numeric / v_max_hour_count::numeric) * 100)::integer))
    ) ORDER BY hs.hr
  ), '[]'::jsonb)
  INTO v_activity_bars
  FROM (SELECT generate_series(9, 18) AS hr) hs
  LEFT JOIN (
    SELECT extract(hour FROM (scheduled_time AT TIME ZONE 'Asia/Kolkata'))::integer AS hr, count(*) AS cnt
    FROM public.appointments
    WHERE (v_eff_clinic_id IS NULL OR clinic_id::text = v_eff_clinic_id)
      AND (v_eff_location_id IS NULL OR location_id::text = v_eff_location_id)
      AND (v_eff_doctor_id IS NULL OR doctor_id = v_eff_doctor_id)
      AND (scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_today
      AND LOWER(status) NOT IN ('cancelled', 'reallocated')
    GROUP BY 1
  ) c ON c.hr = hs.hr;

  v_clinical_subtitle := format('Peak: %s (%s pts) • %s/%s daily quota (%s%%)', 
    v_peak_hour_label, v_peak_hour_count, v_today_patients, v_daily_quota, v_quota_used_pct);

  -- 7. RIGHT CARD: Real 7-Day Intake Trend
  WITH last_7_days AS (
    SELECT (v_today - (d || ' days')::interval)::date AS day_date
    FROM generate_series(6, 0, -1) AS d
  ),
  daily_counts AS (
    SELECT
      l7.day_date,
      to_char(l7.day_date, 'Dy') AS day_name,
      to_char(l7.day_date, 'DD Mon') AS date_label,
      COUNT(a.id) FILTER (WHERE LOWER(COALESCE(a.booking_channel, a.visit_type, '')) ILIKE '%walk%') AS walk_count,
      COUNT(a.id) FILTER (WHERE LOWER(COALESCE(a.booking_channel, a.visit_type, '')) ILIKE '%whatsapp%') AS wa_count
    FROM last_7_days l7
    LEFT JOIN public.appointments a 
      ON (a.scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = l7.day_date
     AND (v_eff_clinic_id IS NULL OR a.clinic_id::text = v_eff_clinic_id)
     AND (v_eff_location_id IS NULL OR a.location_id::text = v_eff_location_id)
     AND (v_eff_doctor_id IS NULL OR a.doctor_id = v_eff_doctor_id)
     AND LOWER(a.status) NOT IN ('cancelled', 'reallocated')
    GROUP BY l7.day_date
    ORDER BY l7.day_date ASC
  )
  SELECT 
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'day', day_name,
        'date_str', date_label,
        'walk_in', walk_count,
        'whatsapp', wa_count,
        'total', walk_count + wa_count
      )
    ), '[]'::jsonb),
    GREATEST(COALESCE(MAX(walk_count + wa_count), 1), 1)
  INTO 
    v_intake_series,
    v_max_daily_intake
  FROM daily_counts;

  v_intake_growth_label := format('Today: %s Walk-in, %s WhatsApp (%s)', 
    v_today_walkin, v_today_whatsapp, v_patient_growth_label);

  -- 8. Patient Queue Table
  SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb) INTO v_queue_list
  FROM (
    SELECT
      a.id::text AS id,
      COALESCE(format('P%s', to_char(a.queue_token_no, 'FM000')), '--') AS token,
      p.full_name AS patient_name,
      COALESCE(p.age, 0) AS age,
      COALESCE(p.gender, 'Female') AS gender,
      p.phone_number AS phone,
      CASE WHEN LOWER(COALESCE(a.booking_channel, a.visit_type, '')) ILIKE '%whatsapp%' THEN 'Online WA' ELSE 'Walk-in' END AS type,
      COALESCE(a.priority, 'Normal') AS priority,
      to_char(a.scheduled_time AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS slot_time,
      a.status,
      d.full_name AS doctor_name,
      loc.branch_name,
      a.location_id
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.patient_id
    LEFT JOIN public.doctors d ON d.id = a.doctor_id
    LEFT JOIN public.clinic_locations loc ON loc.id::text = a.location_id::text
    WHERE (v_eff_clinic_id IS NULL OR a.clinic_id::text = v_eff_clinic_id)
      AND (v_eff_location_id IS NULL OR a.location_id::text = v_eff_location_id)
      AND (v_eff_doctor_id IS NULL OR a.doctor_id = v_eff_doctor_id)
      AND (a.scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_today
      AND LOWER(a.status) NOT IN ('cancelled', 'reallocated')
    ORDER BY
      CASE LOWER(a.status) WHEN 'in progress' THEN 1 WHEN 'waiting' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END,
      a.queue_token_no ASC NULLS LAST,
      a.scheduled_time ASC
    LIMIT 50
  ) q;

  -- 9. Live Activity Feed
  SELECT COALESCE(jsonb_agg(row_to_json(act)), '[]'::jsonb) INTO v_activity_list
  FROM (
    SELECT
      a.id::text AS id,
      CASE
        WHEN LOWER(a.status) = 'completed' THEN format('Completed: %s', p.full_name)
        WHEN LOWER(a.status) IN ('cancelled', 'reallocated') THEN format('Cancelled: %s', p.full_name)
        WHEN a.visit_type ILIKE '%WhatsApp%' OR a.booking_channel ILIKE '%WhatsApp%' THEN format('WhatsApp Booking: %s', p.full_name)
        ELSE format('Walk-in Check-in: %s', p.full_name)
      END AS title,
      format('%s · %s', COALESCE(loc.branch_name, 'Clinic'), COALESCE(d.full_name, 'Doctor')) AS subtitle,
      to_char(COALESCE(a.completed_at, a.updated_at, a.created_at) AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS time,
      CASE
        WHEN LOWER(a.status) = 'completed' THEN 'completed'
        WHEN a.visit_type ILIKE '%WhatsApp%' OR a.booking_channel ILIKE '%WhatsApp%' THEN 'whatsapp'
        ELSE 'pharmacy'
      END AS type
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.patient_id
    LEFT JOIN public.doctors d ON d.id = a.doctor_id
    LEFT JOIN public.clinic_locations loc ON loc.id::text = a.location_id::text
    WHERE (v_eff_clinic_id IS NULL OR a.clinic_id::text = v_eff_clinic_id)
      AND (v_eff_location_id IS NULL OR a.location_id::text = v_eff_location_id)
      AND (v_eff_doctor_id IS NULL OR a.doctor_id = v_eff_doctor_id)
    ORDER BY COALESCE(a.completed_at, a.updated_at, a.created_at) DESC
    LIMIT 10
  ) act;

  -- 9b. Doctors in Chamber (Branch-Scoped Roster + Live Counts)
  SELECT COALESCE(jsonb_agg(row_to_json(dic)), '[]'::jsonb) INTO v_doctors_in_chamber
  FROM (
    SELECT
      d.id::text AS doctor_id,
      d.full_name AS doctor_name,
      COALESCE(d.specialization, 'General Medicine') AS specialization,
      CASE
        WHEN COALESCE(d.is_admin_doctor, false) OR d.location_id IS NULL THEN 'All Branches'
        ELSE COALESCE(loc.branch_name, 'Assigned Branch')
      END AS assigned_branch,
      COALESCE(COUNT(a.id) FILTER (WHERE LOWER(a.status) NOT IN ('cancelled', 'reallocated')), 0)::int AS today_patients,
      COALESCE(d.daily_quota, 30)::int AS daily_quota,
      ROUND(
        LEAST(
          100.0,
          (COALESCE(COUNT(a.id) FILTER (WHERE LOWER(a.status) NOT IN ('cancelled', 'reallocated')), 0)::numeric / GREATEST(COALESCE(d.daily_quota, 30), 1)) * 100.0
        ),
        1
      ) AS quota_pct,
      COALESCE(BOOL_OR(LOWER(a.status) = 'in progress'), false) AS in_chamber,
      COALESCE(COUNT(a.id) FILTER (WHERE LOWER(a.status) = 'waiting'), 0)::int AS waiting_count,
      CASE
        WHEN COALESCE(BOOL_OR(LOWER(a.status) = 'in progress'), false) THEN 'In Chamber'
        WHEN COALESCE(COUNT(a.id) FILTER (WHERE LOWER(a.status) = 'waiting'), 0) = 1 THEN '1 patient waiting'
        WHEN COALESCE(COUNT(a.id) FILTER (WHERE LOWER(a.status) = 'waiting'), 0) > 1 THEN format('%s patients waiting', COUNT(a.id) FILTER (WHERE LOWER(a.status) = 'waiting'))
        ELSE 'Available'
      END AS status_label
    FROM public.doctors d
    LEFT JOIN public.clinic_locations loc ON loc.id::text = d.location_id::text
    LEFT JOIN public.appointments a
      ON a.doctor_id = d.id
     AND (a.scheduled_time AT TIME ZONE 'Asia/Kolkata')::date = v_today
     AND (v_eff_location_id IS NULL OR a.location_id::text = v_eff_location_id)
    WHERE (v_eff_clinic_id IS NULL OR d.clinic_id::text = v_eff_clinic_id)
      AND COALESCE(d.is_active, true) = true
      AND COALESCE(d.is_deleted, false) = false
      AND (
        v_eff_location_id IS NULL
        OR d.location_id::text = v_eff_location_id
        OR d.location_id IS NULL
        OR COALESCE(d.is_admin_doctor, false) = true
      )
      AND (v_eff_doctor_id IS NULL OR d.id = v_eff_doctor_id)
    GROUP BY d.id, d.full_name, d.specialization, d.location_id, d.is_admin_doctor, d.daily_quota, loc.branch_name
    ORDER BY in_chamber DESC, waiting_count DESC, d.full_name ASC
  ) dic;

  -- 10. Return Structured Dashboard Output
  RETURN jsonb_build_object(
    'success', true,
    'doctor_name', v_header_title,
    'timestamp', now(),
    'kpi', jsonb_build_object(
      'today_patients', v_today_patients,
      'today_patients_trend', v_patient_growth_label,
      'completed_consults', v_completed_consults,
      'cancelled_consults', v_cancelled_consults,
      'completion_rate', v_completion_rate,
      'waiting_queue', v_waiting_queue,
      'pharmacy_stock', v_pharmacy_stock
    ),
    'telemetry', jsonb_build_object(
      'active_token', v_active_token,
      'lounge_status', v_lounge_status,
      'waiting_count', v_waiting_queue,
      'doctor_name', v_header_title
    ),
    'clinical_activity', jsonb_build_object(
      'subtitle', v_clinical_subtitle,
      'max_hour_count', v_max_hour_count,
      'bars', v_activity_bars,
      'today_patients', v_today_patients,
      'daily_quota', v_daily_quota,
      'quota_used_pct', v_quota_used_pct,
      'whatsapp_rate_pct', v_today_whatsapp_pct,
      'slot_duration_mins', v_slot_duration,
      'avg_slot_label', v_slot_duration || 'm',
      'pharmacy_stock', v_pharmacy_stock,
      'metrics', jsonb_build_object(
        'patients', v_today_patients,
        'quota_pct', v_quota_used_pct,
        'whatsapp_pct', v_today_whatsapp_pct,
        'completion_rate', v_completion_rate,
        'avg_time', v_slot_duration || 'm',
        'pharmacy_stock', v_pharmacy_stock
      )
    ),
    'intake_overview', jsonb_build_object(
      'growth_label', v_intake_growth_label,
      'max_daily_intake', v_max_daily_intake,
      'series', v_intake_series
    ),
    'doctors_in_chamber', v_doctors_in_chamber,
    'projects_queue', v_queue_list,
    'orders_overview', v_activity_list
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_pavilion_dashboard_summary(text, text, uuid, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
