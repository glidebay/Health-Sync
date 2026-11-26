-- ════════════════════════════════════════════════════════════════════════════
-- ATOMIC CONSULTATION COMPLETION & INVENTORY DEDUCTION RPC
-- Ensures appointment completion, prescription inserts, and branch stock
-- deductions execute inside one ACID transaction (no partial updates).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.complete_consultation_transaction(
  p_appointment_id uuid,
  p_notes text DEFAULT NULL,
  p_next_visit_date date DEFAULT NULL,
  p_prescriptions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_appt record;
  v_rx jsonb;
  v_inv_id text;
  v_qty integer;
  v_batch_id uuid;
  v_completed_status text := 'Completed';
BEGIN
  IF p_appointment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appointment ID is required');
  END IF;

  SELECT id, status, location_id
  INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appointment not found');
  END IF;

  -- Preserve DB status casing convention if table uses lowercase
  IF v_appt.status IS NOT NULL AND v_appt.status = lower(v_appt.status) THEN
    v_completed_status := 'completed';
  END IF;

  UPDATE public.appointments
  SET
    status = v_completed_status,
    clinical_notes = COALESCE(p_notes, clinical_notes),
    next_visit_date = COALESCE(p_next_visit_date, next_visit_date),
    updated_at = now()
  WHERE id = p_appointment_id;

  IF p_prescriptions IS NOT NULL AND jsonb_typeof(p_prescriptions) = 'array' THEN
    FOR v_rx IN SELECT * FROM jsonb_array_elements(p_prescriptions)
    LOOP
      v_inv_id := NULLIF(TRIM(COALESCE(v_rx->>'inventory_id', '')), '');
      v_qty := GREATEST(0, COALESCE((v_rx->>'qty')::integer, 0));

      IF v_inv_id IS NOT NULL AND v_qty > 0 THEN
        INSERT INTO public.prescribed_medications (
          appointment_id,
          inventory_id,
          dispensed_quantity,
          medicine_name,
          dosage,
          frequency,
          duration,
          instructions,
          created_at
        ) VALUES (
          p_appointment_id,
          v_inv_id,
          v_qty,
          NULLIF(TRIM(COALESCE(v_rx->>'medicine_name', '')), ''),
          NULLIF(TRIM(COALESCE(v_rx->>'dosage', '')), ''),
          NULLIF(TRIM(COALESCE(v_rx->>'frequency', '')), ''),
          NULLIF(TRIM(COALESCE(v_rx->>'duration', '')), ''),
          NULLIF(TRIM(COALESCE(v_rx->>'instructions', '')), ''),
          now()
        );

        -- Atomically decrement inventory table (if matching row exists)
        UPDATE public.inventory
        SET
          stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - v_qty),
          last_updated = now()
        WHERE id::text = v_inv_id;

        -- Otherwise decrement earliest active medicine_batch if medicine master schema is used
        IF NOT FOUND THEN
          SELECT mb.id INTO v_batch_id
          FROM public.medicine_batches mb
          WHERE mb.medicine_id::text = v_inv_id
            AND COALESCE(mb.available_quantity, 0) > 0
          ORDER BY mb.expiry_date ASC NULLS LAST, mb.created_at ASC
          LIMIT 1
          FOR UPDATE;

          IF v_batch_id IS NOT NULL THEN
            UPDATE public.medicine_batches
            SET available_quantity = GREATEST(0, COALESCE(available_quantity, 0) - v_qty)
            WHERE id = v_batch_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.appointment_logs (
    appointment_id,
    action,
    reason,
    performed_by
  ) VALUES (
    p_appointment_id,
    'Consultation Completed',
    'Consultation notes and prescriptions recorded atomically',
    'Doctor'
  );

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'status', v_completed_status
  );
END;
$func$;
