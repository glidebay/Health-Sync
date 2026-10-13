-- ====================================================================
-- Health-Sync: Complete Supabase Permissions & Disable RLS
-- Run this in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ====================================================================

-- 1. Disable Row Level Security (RLS) so the app can read/write directly
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescribed_medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_requests DISABLE ROW LEVEL SECURITY;

-- 2. Grant full permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;
