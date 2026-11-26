-- ════════════════════════════════════════════════════════════════════════════
-- FIX PGRST203: REMOVE AMBIGUOUS OVERLOAD OF get_pavilion_dashboard_summary
-- Keeps the text p_clinic_id version and drops the conflicting uuid p_clinic_id
-- overload so PostgREST resolves the RPC cleanly without 300 Multiple Choices.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop the conflicting overload (p_doctor_id uuid, p_clinic_id uuid, p_location_id text, p_logged_doctor_id uuid)
DROP FUNCTION IF EXISTS public.get_pavilion_dashboard_summary(uuid, uuid, text, uuid);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify only 1 signature remains for get_pavilion_dashboard_summary
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_pavilion_dashboard_summary';
