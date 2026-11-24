-- ════════════════════════════════════════════════════════════════════════════
-- UNIFIED BRANCH-WISE SETTINGS ENGINE (PostgreSQL RPC Functions)
-- ════════════════════════════════════════════════════════════════════════════

-- Ensure columns exist in clinic_locations
ALTER TABLE public.clinic_locations
  ADD COLUMN IF NOT EXISTS pad_template_url text,
  ADD COLUMN IF NOT EXISTS rx_calibrations jsonb,
  ADD COLUMN IF NOT EXISTS print_bg_graphic boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_custom_pad_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rx_footer_text text;

-- Ensure audit_logs table exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- 1. GET CLINIC SETTINGS UNIFIED
CREATE OR REPLACE FUNCTION public.get_clinic_settings_unified(
  p_clinic_id   text,
  p_admin_pin   text DEFAULT NULL,
  p_location_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic RECORD;
  v_branch RECORD;
  v_res jsonb;
BEGIN
  -- Validate clinic
  SELECT id, name, phone, email, address, logo_url
  INTO v_clinic
  FROM public.clinics
  WHERE id::text = p_clinic_id;

  IF v_clinic.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CLINIC_NOT_FOUND', 'message', 'Clinic tenant not found');
  END IF;

  -- Validate branch
  IF p_location_id IS NOT NULL THEN
    SELECT id, branch_name, branch_code, phone, address, landmark, daily_quota, slot_duration_mins, gateway_pin,
           pad_template_url, rx_calibrations, print_bg_graphic, is_custom_pad_active, rx_footer_text
    INTO v_branch
    FROM public.clinic_locations
    WHERE id::text = p_location_id AND clinic_id::text = p_clinic_id;
  ELSE
    SELECT id, branch_name, branch_code, phone, address, landmark, daily_quota, slot_duration_mins, gateway_pin,
           pad_template_url, rx_calibrations, print_bg_graphic, is_custom_pad_active, rx_footer_text
    INTO v_branch
    FROM public.clinic_locations
    WHERE clinic_id::text = p_clinic_id AND is_active = true
    LIMIT 1;
  END IF;

  v_res := jsonb_build_object(
    'success', true,
    'clinic_id', v_clinic.id,
    'clinic_name', v_clinic.name,
    'clinic_phone', v_clinic.phone,
    'clinic_email', v_clinic.email,
    'clinic_address', v_clinic.address,
    'clinic_logo_url', v_clinic.logo_url,
    'location_id', v_branch.id,
    'branch_name', v_branch.branch_name,
    'branch_code', v_branch.branch_code,
    'branch_phone', v_branch.phone,
    'branch_address', v_branch.address,
    'branch_landmark', v_branch.landmark,
    'daily_quota', COALESCE(v_branch.daily_quota, 40),
    'slot_duration_mins', COALESCE(v_branch.slot_duration_mins, 15),
    'gateway_pin', v_branch.gateway_pin,
    'pad_template_url', v_branch.pad_template_url,
    'rx_calibrations', v_branch.rx_calibrations,
    'print_bg_graphic', COALESCE(v_branch.print_bg_graphic, true),
    'is_custom_pad_active', COALESCE(v_branch.is_custom_pad_active, false),
    'rx_footer_text', v_branch.rx_footer_text
  );

  RETURN v_res;
END;
$$;

-- 2. SAVE CLINIC SETTINGS UNIFIED
CREATE OR REPLACE FUNCTION public.save_clinic_settings_unified(
  p_clinic_id             text,
  p_admin_pin             text DEFAULT NULL,
  p_location_id           text DEFAULT NULL,
  p_clinic_name           text DEFAULT NULL,
  p_clinic_phone          text DEFAULT NULL,
  p_daily_quota           integer DEFAULT NULL,
  p_slot_duration_mins    integer DEFAULT NULL,
  p_allow_quota_override  boolean DEFAULT NULL,
  p_require_doctor_pin    boolean DEFAULT NULL,
  p_pin_autolock_mins     integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update clinic
  IF p_clinic_name IS NOT NULL OR p_clinic_phone IS NOT NULL THEN
    UPDATE public.clinics
    SET
      name = COALESCE(p_clinic_name, name),
      phone = COALESCE(p_clinic_phone, phone),
      updated_at = now()
    WHERE id::text = p_clinic_id;
  END IF;

  -- Update branch
  IF p_location_id IS NOT NULL THEN
    UPDATE public.clinic_locations
    SET
      daily_quota = COALESCE(p_daily_quota, daily_quota),
      slot_duration_mins = COALESCE(p_slot_duration_mins, slot_duration_mins),
      updated_at = now()
    WHERE id::text = p_location_id;
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs (action, entity, entity_id, details)
  VALUES (
    'SAVE_SETTINGS_UNIFIED',
    'CLINIC',
    p_clinic_id,
    jsonb_build_object(
      'location_id', p_location_id,
      'daily_quota', p_daily_quota,
      'slot_duration_mins', p_slot_duration_mins,
      'updated_at', now()
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Settings successfully updated.');
END;
$$;

-- 3. SAVE PRESCRIPTION LAYOUT
CREATE OR REPLACE FUNCTION public.save_prescription_layout(
  p_clinic_id               text,
  p_admin_pin               text DEFAULT NULL,
  p_location_id             text DEFAULT NULL,
  p_enable_template         boolean DEFAULT false,
  p_print_background        boolean DEFAULT true,
  p_pad_image_url           text DEFAULT NULL,
  p_field_coordinates_json  jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_location_id IS NOT NULL THEN
    UPDATE public.clinic_locations
    SET
      is_custom_pad_active = p_enable_template,
      print_bg_graphic = p_print_background,
      pad_template_url = p_pad_image_url,
      rx_calibrations = p_field_coordinates_json,
      updated_at = now()
    WHERE id::text = p_location_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Prescription pad layout calibrated.');
END;
$$;

-- 4. RESET BRANCH SETTINGS TO DEFAULTS
CREATE OR REPLACE FUNCTION public.reset_branch_settings_to_defaults(
  p_clinic_id   text,
  p_admin_pin   text DEFAULT NULL,
  p_location_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_location_id IS NOT NULL THEN
    UPDATE public.clinic_locations
    SET
      daily_quota = 40,
      slot_duration_mins = 15,
      is_custom_pad_active = false,
      print_bg_graphic = true,
      updated_at = now()
    WHERE id::text = p_location_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Branch settings reset to factory defaults.');
END;
$$;
