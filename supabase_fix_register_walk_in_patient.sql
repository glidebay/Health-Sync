-- ============================================================================
-- RPC: register_walk_in_patient (Branch-Scoped, Quota-Aware, Collision-Safe)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.register_walk_in_patient(
  p_full_name       text,
  p_phone_number    text,
  p_doctor_id       uuid,
  p_location_id     uuid DEFAULT NULL,
  p_clinic_id       uuid DEFAULT NULL,
  p_age             integer DEFAULT NULL,
  p_gender          text DEFAULT NULL,
  p_priority        text DEFAULT NULL,
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
  v_daily_quota integer;
  v_slot_duration integer;
  v_allow_override text;
  v_today_count integer;
  v_token_no integer;
  v_start_time time;
  v_end_time time;
  v_start_timestamptz timestamptz;
  v_end_timestamptz timestamptz;
  v_candidate_slot timestamptz;
  v_booking_time timestamptz;
  v_found boolean := false;
BEGIN
  -- 1. READ APP_CONFIG
  SELECT coalesce(value::int, 20) INTO v_daily_quota   FROM app_config WHERE key = 'daily_quota';
  SELECT coalesce(value::int, 15) INTO v_slot_duration  FROM app_config WHERE key = 'slot_duration_mins';
  SELECT coalesce(value, 'true')  INTO v_allow_override FROM app_config WHERE key = 'allow_quota_override';

  -- 2. VALIDATE NAME & PHONE
  v_clean_name := trim(coalesce(p_full_name, ''));
  IF v_clean_name = '' OR length(v_clean_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_NAME',
      'error_message', 'Patient name must be at least 2 characters.');
  END IF;

  v_clean_phone := trim(coalesce(p_phone_number, ''));
  IF v_clean_phone = '' OR length(regexp_replace(v_clean_phone, '[^0-9]', '', 'g')) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MISSING_PHONE',
      'error_message', 'Phone number must contain at least 10 digits.');
  END IF;

  -- 3. VERIFY DOCTOR
  IF NOT EXISTS (SELECT 1 FROM doctors WHERE id = p_doctor_id) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'DOCTOR_NOT_FOUND',
      'error_message', 'Selected doctor not found.');
  END IF;

  -- 4. QUOTA CHECK (branch-scoped)
  PERFORM 1 FROM doctors WHERE id = p_doctor_id FOR UPDATE;
  SELECT count(*) INTO v_today_count
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND (p_location_id IS NULL OR location_id = p_location_id)
    AND (p_clinic_id   IS NULL OR clinic_id   = p_clinic_id)
    AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
    AND status NOT IN ('Cancelled', 'Reallocated');

  IF v_today_count >= v_daily_quota THEN
    IF p_priority = 'Urgent' AND v_allow_override = 'true' THEN
      NULL; -- Emergency bypass
    ELSE
      RETURN jsonb_build_object('success', false, 'error_code', 'QUOTA_FULL',
        'error_message', 'Daily quota of ' || v_daily_quota || ' patients reached. ' ||
        CASE WHEN v_allow_override = 'true'
          THEN 'Mark Priority as Urgent for emergency walk-in.'
          ELSE 'Emergency override is disabled in App Settings.' END);
    END IF;
  END IF;

  -- 5. FIND NEAREST AVAILABLE SLOT
  IF p_scheduled_time IS NOT NULL THEN
    v_booking_time := p_scheduled_time;
    IF EXISTS (
      SELECT 1 FROM appointments
      WHERE doctor_id = p_doctor_id
        AND (p_location_id IS NULL OR location_id = p_location_id)
        AND scheduled_time = v_booking_time
        AND status NOT IN ('Cancelled', 'Reallocated')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'SLOT_TAKEN',
        'error_message', 'This slot is already booked.',
        'suggested_time', to_char((v_booking_time + (v_slot_duration || ' minutes')::interval)
          AT TIME ZONE 'Asia/Kolkata', 'hh12:mi AM'));
    END IF;
  ELSE
    SELECT start_time, end_time INTO v_start_time, v_end_time
    FROM doctor_schedules
    WHERE doctor_id = p_doctor_id
      AND day_of_week IN (
        extract(dow FROM current_date)::smallint,
        extract(isodow FROM current_date)::smallint
      )
    LIMIT 1;

    v_start_time := coalesce(v_start_time, time '09:00:00');
    v_end_time   := coalesce(v_end_time,   time '18:00:00');
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
        SELECT 1 FROM appointments
        WHERE doctor_id = p_doctor_id
          AND (p_location_id IS NULL OR location_id = p_location_id)
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
      v_booking_time := now();
    END IF;
  END IF;

  -- 6. UPSERT PATIENT (branch-scoped duplicate check)
  SELECT id INTO v_patient_id FROM patients WHERE phone_number = v_clean_phone;
  IF v_patient_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM appointments
      WHERE patient_id  = v_patient_id
        AND doctor_id   = p_doctor_id
        AND (p_location_id IS NULL OR location_id = p_location_id)
        AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
        AND status IN ('Waiting', 'In Progress')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'DUPLICATE_VISIT',
        'error_message', 'Patient already has an active visit in this branch today.');
    END IF;

    UPDATE patients
    SET full_name = v_clean_name,
        age       = coalesce(p_age,    age),
        gender    = coalesce(p_gender, gender)
    WHERE id = v_patient_id;
  ELSE
    INSERT INTO patients (full_name, phone_number, age, gender)
    VALUES (v_clean_name, v_clean_phone, p_age, p_gender)
    RETURNING id INTO v_patient_id;
  END IF;

  -- 7. SEQUENTIAL TOKEN (branch-scoped)
  SELECT count(*) + 1 INTO v_token_no
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND (p_location_id IS NULL OR location_id = p_location_id)
    AND (p_clinic_id   IS NULL OR clinic_id   = p_clinic_id)
    AND date(scheduled_time AT TIME ZONE 'Asia/Kolkata') = current_date
    AND status NOT IN ('Cancelled', 'Reallocated');

  -- 8. INSERT APPOINTMENT
  INSERT INTO appointments (
    patient_id, doctor_id, location_id, clinic_id,
    scheduled_time, status, visit_type, priority, queue_token_no
  )
  VALUES (
    v_patient_id, p_doctor_id, p_location_id, p_clinic_id,
    v_booking_time, 'Waiting',
    'Walk-in', coalesce(p_priority, 'Normal'), v_token_no
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success',            true,
    'message',            'Walk-in booked in nearest available slot!',
    'appointment_id',     v_appointment_id,
    'patient_name',       v_clean_name,
    'assigned_slot',      to_char(v_booking_time AT TIME ZONE 'Asia/Kolkata', 'hh12:mi AM'),
    'queue_token_no',     v_token_no,
    'daily_quota_status', (v_today_count + 1) || ' of ' || v_daily_quota,
    'priority',           coalesce(p_priority, 'Normal'),
    'status',             'Waiting',
    'location_id',        p_location_id,
    'clinic_id',          p_clinic_id
  );
END;
$func$;
