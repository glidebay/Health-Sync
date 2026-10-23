-- ====================================================================
-- HealthSync: Application Settings Architecture & Parameter Catalog
-- Run this in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'Admin'
);

-- Disable Row Level Security during initial rollout
ALTER TABLE public.app_config DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.app_config TO anon, authenticated;

-- Seed default catalog values (23 parameters across 6 categories)
INSERT INTO public.app_config (key, value, category, description) VALUES
  -- 1. Clinic Identity & Branding
  ('clinic_name', '"HealthSync Clinic"', 'Clinic Identity & Branding', 'Official display name of the medical clinic for header banners and receipts.'),
  ('clinic_phone', '"+91 98765 43210"', 'Clinic Identity & Branding', 'Primary contact phone number displayed on patient receipts and WhatsApp communications.'),
  ('clinic_address', '"123 Main St, Kochi, Kerala"', 'Clinic Identity & Branding', 'Physical address printed on official prescription headers and patient receipts.'),
  ('logo_url', '"/assets/logo.png"', 'Clinic Identity & Branding', 'File upload or asset URL for rendering the clinic logo on UI headers and PDFs.'),
  ('rx_footer_text', '"Get well soon! Contact clinic for emergencies."', 'Clinic Identity & Branding', 'Standard legal or health advisory notice printed at the bottom of physical prescriptions.'),

  -- 2. Doctor & Quota Controls
  ('daily_quota', '30', 'Doctor & Quota Controls', 'Maximum number of patients a doctor can consult in a single day before blocking new bookings.'),
  ('slot_duration_mins', '15', 'Doctor & Quota Controls', 'Estimated time allocated per patient appointment slot for queue scheduling calculations.'),
  ('allow_quota_override', 'true', 'Doctor & Quota Controls', 'Enables clinic reception assistants to manually override and book patients even when daily quota is reached.'),
  ('require_doctor_pin', 'true', 'Doctor & Quota Controls', 'Enforces a 4-digit PIN security modal before opening clinical consultation views and medical charts.'),
  ('pin_lock_timeout_mins', '"15"', 'Doctor & Quota Controls', 'Inactivity duration after which the doctor consultation workspace automatically locks and requires PIN re-entry.'),

  -- 3. Queue & Patient Logistics
  ('queue_sort_order', '"Scheduled Time"', 'Queue & Patient Logistics', 'Determines how patients are ordered in the live waiting room queue.'),
  ('late_grace_period_mins', '15', 'Queue & Patient Logistics', 'Window of time a late patient retains their queue position before being flagged for slot reallocation.'),
  ('auto_move_unattended', 'false', 'Queue & Patient Logistics', 'Automatically shifts no-show or late patients to the end of the daily queue after grace period expires.'),
  ('max_advance_booking_days', '7', 'Queue & Patient Logistics', 'Maximum number of days in advance a patient can book an appointment slot via WhatsApp link.'),
  ('use_standard_date_picker', 'false', 'Queue & Patient Logistics', 'Toggle between standard calendar date picker and interactive time block grid for slot selection.'),

  -- 4. WhatsApp & Communication Automation
  ('enable_whatsapp_autoresponder', 'true', 'WhatsApp & Communication Automation', 'Enables auto-replying with a self-service booking web link when a patient texts the clinic phone number.'),
  ('whatsapp_trigger_keyword', '"Hello"', 'WhatsApp & Communication Automation', 'Inbound text message keyword that triggers the automated WhatsApp booking link response.'),
  ('whatsapp_welcome_template', '"Hello! Book your appointment here: {booking_link}"', 'WhatsApp & Communication Automation', 'Text message template sent to patients containing greeting and dynamic self-service booking URL.'),
  ('booking_link_ttl_hours', '2', 'WhatsApp & Communication Automation', 'Time-to-live (TTL) for generated self-service booking web links before they expire.'),
  ('enable_whatsapp_bot', 'false', 'WhatsApp & Communication Automation', 'Toggles full Meta WhatsApp Cloud API serverless webhook listener for natural text booking parsing.'),
  ('reminder_lead_time_hours', '2', 'WhatsApp & Communication Automation', 'Hours prior to appointment start time when an automated WhatsApp reminder text is dispatched.'),

  -- 5. Pharmacy & Inventory Safeguards
  ('restrict_out_of_stock_rx', 'true', 'Pharmacy & Inventory Safeguards', 'Blocks doctors from selecting or prescribing medications that have zero available stock units.'),
  ('auto_deduct_inventory', 'true', 'Pharmacy & Inventory Safeguards', 'Automatically subtracts prescribed medicine quantities from master inventory upon consultation completion.'),
  ('default_reorder_threshold', '10', 'Pharmacy & Inventory Safeguards', 'Global default unit count that triggers yellow warning badges in the pharmacy inventory UI.'),
  ('currency_symbol', '"₹ (INR)"', 'Pharmacy & Inventory Safeguards', 'Currency symbol used across inventory procurement, billing, and financial analytics UI.'),

  -- 6. System, Security & Data Privacy (Provisions)
  ('session_timeout_mins', '30', 'System, Security & Data Privacy', 'Inactivity duration before the Supabase authentication JWT session expires and requires re-login.'),
  ('enable_pwa_offline', 'true', 'System, Security & Data Privacy', 'Enables Progressive Web App service worker caching for offline form entries and fast UI loading.'),
  ('audit_log_level', '"Standard"', 'System, Security & Data Privacy', 'Level of detail recorded in system audit logs for administrative, clinical, and inventory actions.'),
  ('rls_enforce_mode', '"Strict"', 'System, Security & Data Privacy', 'Database security policy mode governing multi-role data access isolation in Supabase PostgreSQL.')
ON CONFLICT (key) DO NOTHING;
