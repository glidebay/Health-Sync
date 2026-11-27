-- ════════════════════════════════════════════════════════════════════════════
-- MULTI-NUMBER WHATSAPP ROUTING FOR CLINIC BRANCHES
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Ensure WhatsApp routing columns exist on public.clinic_locations
ALTER TABLE public.clinic_locations
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_display_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

-- 2. Fast lookup index for incoming Meta webhook metadata.phone_number_id
CREATE INDEX IF NOT EXISTS idx_clinic_locations_wa_phone_id
  ON public.clinic_locations(whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;

-- 3. Example: Assign dedicated WhatsApp numbers per branch
--    (Or configure directly via Settings -> Branches in the HealthSync UI)
-- UPDATE public.clinic_locations
-- SET whatsapp_phone_number_id = 'PASTE_BRANCH_PHONE_NUMBER_ID',
--     whatsapp_display_number  = '+91 98471 22222',
--     whatsapp_access_token    = NULL -- only needed if this clinic uses a separate Meta WABA token
-- WHERE id = 'loc-7f4b3842bc';
