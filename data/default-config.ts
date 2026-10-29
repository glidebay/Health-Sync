export interface RxFieldCoord {
  x: number;
  y: number;
  width?: number;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface RxTemplateFields {
  patientName: RxFieldCoord;
  patientAge: RxFieldCoord;
  patientGender: RxFieldCoord;
  patientPhone: RxFieldCoord;
  consultationDate: RxFieldCoord;
  tokenNumber: RxFieldCoord;
  diagnostics: RxFieldCoord;
  medications: RxFieldCoord;
  doctorName: RxFieldCoord;
  doctorSignature: RxFieldCoord;
}

export const DEFAULT_RX_TEMPLATE_FIELDS: RxTemplateFields = {
  patientName: { x: 19, y: 26.2, fontSize: 13, fontWeight: 'bold', visible: true, align: 'left' },
  patientAge: { x: 17, y: 29.3, fontSize: 13, fontWeight: 'bold', visible: true, align: 'left' },
  patientGender: { x: 19, y: 32.3, fontSize: 13, fontWeight: 'bold', visible: true, align: 'left' },
  patientPhone: { x: 42, y: 29.3, fontSize: 12, fontWeight: 'medium', visible: true, align: 'left' },
  consultationDate: { x: 15, y: 82.5, width: 25, fontSize: 12, fontWeight: 'bold', visible: true, align: 'center' },
  tokenNumber: { x: 75, y: 26.2, fontSize: 12, fontWeight: 'bold', visible: true, align: 'right' },
  diagnostics: { x: 18, y: 35.5, width: 72, fontSize: 12, fontWeight: 'normal', visible: true, align: 'left' },
  medications: { x: 15, y: 44, width: 72, fontSize: 12, fontWeight: 'normal', visible: true, align: 'left' },
  doctorName: { x: 65, y: 80, width: 30, fontSize: 12, fontWeight: 'bold', visible: true, align: 'center' },
  doctorSignature: { x: 65, y: 82.5, width: 30, fontSize: 12, fontWeight: 'semibold', visible: true, align: 'center' },
};

export interface AppConfig {
  clinic_name: string;
  clinic_phone: string;
  clinic_address: string;
  logo_url: string;
  rx_footer_text: string;

  rx_template_url: string;
  rx_template_enabled: boolean;
  rx_template_print_bg: boolean;
  rx_template_fields: string;

  daily_quota: number;
  slot_duration_mins: number;
  allow_quota_override: boolean;
  require_doctor_pin: boolean;
  pin_lock_timeout_mins: string;

  queue_sort_order: 'Scheduled Time' | 'Arrival Order' | 'VIP First' | string;
  late_grace_period_mins: number;
  auto_move_unattended: boolean;
  max_advance_booking_days: number;
  use_standard_date_picker: boolean;

  enable_whatsapp_autoresponder: boolean;
  whatsapp_trigger_keyword: string;
  whatsapp_welcome_template: string;
  booking_link_ttl_hours: number;
  enable_whatsapp_bot: boolean;
  reminder_lead_time_hours: number;

  restrict_out_of_stock_rx: boolean;
  auto_deduct_inventory: boolean;
  default_reorder_threshold: number;
  currency_symbol: string;

  session_timeout_mins: number;
  enable_pwa_offline: boolean;
  audit_log_level: 'Minimal' | 'Standard' | 'Detailed' | string;
  rls_enforce_mode: 'Strict' | 'Permissive' | string;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  clinic_name: 'HealthSync Clinic',
  clinic_phone: '+91 98765 43210',
  clinic_address: '123 Main St, Kochi, Kerala',
  logo_url: '/assets/logo.png',
  rx_footer_text: 'Get well soon! Contact clinic for emergencies.',

  rx_template_url: '',
  rx_template_enabled: false,
  rx_template_print_bg: true,
  rx_template_fields: JSON.stringify(DEFAULT_RX_TEMPLATE_FIELDS),

  daily_quota: 30,
  slot_duration_mins: 15,
  allow_quota_override: true,
  require_doctor_pin: true,
  pin_lock_timeout_mins: '15',

  queue_sort_order: 'Scheduled Time',
  late_grace_period_mins: 15,
  auto_move_unattended: false,
  max_advance_booking_days: 7,
  use_standard_date_picker: false,

  enable_whatsapp_autoresponder: true,
  whatsapp_trigger_keyword: 'Hello',
  whatsapp_welcome_template: 'Hello! Book your appointment here: {booking_link}',
  booking_link_ttl_hours: 2,
  enable_whatsapp_bot: false,
  reminder_lead_time_hours: 2,

  restrict_out_of_stock_rx: true,
  auto_deduct_inventory: true,
  default_reorder_threshold: 10,
  currency_symbol: '₹ (INR)',

  session_timeout_mins: 30,
  enable_pwa_offline: true,
  audit_log_level: 'Standard',
  rls_enforce_mode: 'Strict',
};

export interface ParameterMetadata {
  key: keyof AppConfig;
  name: string;
  category: string;
  paramType: 'Functional Parameter' | 'Control Parameter';
  description: string;
  uiWidget: 'text' | 'phone' | 'textarea' | 'number' | 'toggle' | 'select' | 'file';
  options?: (string | number)[];
  min?: number;
  max?: number;
  target: string;
  role: 'Admin' | 'Admin / Doctor';
  isProvision?: boolean;
}

export const SETTINGS_METADATA: ParameterMetadata[] = [
  {
    key: 'clinic_name',
    name: 'Clinic Name',
    category: 'Clinic Identity & Branding',
    paramType: 'Functional Parameter',
    description: 'Official display name of the medical clinic for header banners and receipts.',
    uiWidget: 'text',
    target: 'app_config.clinic_name',
    role: 'Admin',
  },
  {
    key: 'clinic_phone',
    name: 'Clinic Phone / WhatsApp Contact',
    category: 'Clinic Identity & Branding',
    paramType: 'Functional Parameter',
    description: 'Primary contact phone number displayed on patient receipts and WhatsApp communications.',
    uiWidget: 'phone',
    target: 'app_config.clinic_phone',
    role: 'Admin',
  },
  {
    key: 'clinic_address',
    name: 'Clinic Address',
    category: 'Clinic Identity & Branding',
    paramType: 'Functional Parameter',
    description: 'Physical address printed on official prescription headers and patient receipts.',
    uiWidget: 'textarea',
    target: 'app_config.clinic_address',
    role: 'Admin',
  },
  {
    key: 'logo_url',
    name: 'Clinic Logo Asset',
    category: 'Clinic Identity & Branding',
    paramType: 'Functional Parameter',
    description: 'Upload clinic branding logo for receipts, headers, and prescriptions.',
    uiWidget: 'file',
    target: 'app_config.logo_url',
    role: 'Admin',
  },
  {
    key: 'rx_footer_text',
    name: 'Prescription Footer Notice',
    category: 'Clinic Identity & Branding',
    paramType: 'Functional Parameter',
    description: 'Standard legal or health advisory notice printed at the bottom of physical prescriptions.',
    uiWidget: 'textarea',
    target: 'app_config.rx_footer_text',
    role: 'Admin',
  },

  {
    key: 'daily_quota',
    name: 'Default Daily Consultation Quota',
    category: 'Doctor & Quota Controls',
    paramType: 'Functional Parameter',
    description: 'Maximum number of patients a doctor can consult in a single day before blocking new bookings.',
    uiWidget: 'number',
    min: 1,
    max: 200,
    target: 'doctors.daily_quota',
    role: 'Admin / Doctor',
  },
  {
    key: 'slot_duration_mins',
    name: 'Consultation Slot Duration',
    category: 'Doctor & Quota Controls',
    paramType: 'Functional Parameter',
    description: 'Estimated time allocated per patient appointment slot for queue scheduling calculations.',
    uiWidget: 'select',
    options: [10, 15, 20, 30],
    target: 'app_config.slot_duration_mins',
    role: 'Admin',
  },
  {
    key: 'allow_quota_override',
    name: 'Allow Emergency Quota Override',
    category: 'Doctor & Quota Controls',
    paramType: 'Control Parameter',
    description: 'Enables clinic reception assistants to manually override and book patients even when daily quota is reached.',
    uiWidget: 'toggle',
    target: 'app_config.allow_quota_override',
    role: 'Admin',
  },
  {
    key: 'require_doctor_pin',
    name: 'Require Doctor PIN Overlay',
    category: 'Doctor & Quota Controls',
    paramType: 'Control Parameter',
    description: 'Enforces a 4-digit PIN security modal before opening clinical consultation views and medical charts.',
    uiWidget: 'toggle',
    target: 'app_config.require_doctor_pin',
    role: 'Admin / Doctor',
  },
  {
    key: 'pin_lock_timeout_mins',
    name: 'PIN Auto-Lock Timeout',
    category: 'Doctor & Quota Controls',
    paramType: 'Control Parameter',
    description: 'Inactivity duration after which the doctor consultation workspace automatically locks and requires PIN re-entry.',
    uiWidget: 'select',
    options: ['5', '10', '15', '30', 'Never'],
    target: 'app_config.pin_lock_timeout_mins',
    role: 'Admin / Doctor',
  },

  {
    key: 'queue_sort_order',
    name: 'Live Queue Sorting Rule',
    category: 'Queue & Patient Logistics',
    paramType: 'Control Parameter',
    description: 'Determines how patients are ordered in the live waiting room queue.',
    uiWidget: 'select',
    options: ['Scheduled Time', 'Arrival Order', 'VIP First'],
    target: 'app_config.queue_sort_order',
    role: 'Admin',
  },
  {
    key: 'late_grace_period_mins',
    name: 'Late Arrival Tolerance Period',
    category: 'Queue & Patient Logistics',
    paramType: 'Control Parameter',
    description: 'Set how long a late patient can retain their queue position before being flagged for slot reassignment.',
    uiWidget: 'select',
    options: [5, 10, 15, 30],
    target: 'app_config.late_grace_period_mins',
    role: 'Admin',
  },
  {
    key: 'auto_move_unattended',
    name: 'Automatic Queue Reordering',
    category: 'Queue & Patient Logistics',
    paramType: 'Control Parameter',
    description: 'Automatically moves patients who miss their appointment or exceed the grace period to the end of the daily queue.',
    uiWidget: 'toggle',
    target: 'app_config.auto_move_unattended',
    role: 'Admin',
  },
  {
    key: 'max_advance_booking_days',
    name: 'Advance Booking Limit',
    category: 'Queue & Patient Logistics',
    paramType: 'Control Parameter',
    description: 'Set the maximum number of days in advance that patients can book appointment slots through the WhatsApp booking link.',
    uiWidget: 'number',
    min: 1,
    max: 30,
    target: 'app_config.max_advance_booking_days',
    role: 'Admin',
  },
  {
    key: 'use_standard_date_picker',
    name: 'Appointment Scheduling View',
    category: 'Queue & Patient Logistics',
    paramType: 'Control Parameter',
    description: 'Toggle on to use a standard calendar date picker and time input for slot booking and rescheduling, or keep off for the interactive time block grid.',
    uiWidget: 'toggle',
    target: 'app_config.use_standard_date_picker',
    role: 'Admin',
  },

  {
    key: 'enable_whatsapp_autoresponder',
    name: 'Enable WhatsApp Auto-Responder',
    category: 'WhatsApp & Communication Automation',
    paramType: 'Control Parameter',
    description: 'Enables auto-replying with a self-service booking web link when a patient texts the clinic phone number.',
    uiWidget: 'toggle',
    target: 'app_config.enable_whatsapp_autoresponder',
    role: 'Admin',
  },
  {
    key: 'whatsapp_trigger_keyword',
    name: 'Auto-Responder Keyword Trigger',
    category: 'WhatsApp & Communication Automation',
    paramType: 'Control Parameter',
    description: 'Inbound text message keyword that triggers the automated WhatsApp booking link response.',
    uiWidget: 'text',
    target: 'app_config.whatsapp_trigger_keyword',
    role: 'Admin',
  },
  {
    key: 'whatsapp_welcome_template',
    name: 'Welcome & Booking Link Template',
    category: 'WhatsApp & Communication Automation',
    paramType: 'Functional Parameter',
    description: 'Text message template sent to patients containing greeting and dynamic self-service booking URL with {booking_link}.',
    uiWidget: 'textarea',
    target: 'app_config.whatsapp_welcome_template',
    role: 'Admin',
  },
  {
    key: 'booking_link_ttl_hours',
    name: 'Booking Link Expiry Duration',
    category: 'WhatsApp & Communication Automation',
    paramType: 'Control Parameter',
    description: 'Time-to-live (TTL) for generated self-service booking web links before they expire.',
    uiWidget: 'select',
    options: [1, 2, 4, 12, 24],
    target: 'app_config.booking_link_ttl_hours',
    role: 'Admin',
  },
  {
    key: 'enable_whatsapp_bot',
    name: 'Enable Interactive Chatbot (Phase 2)',
    category: 'WhatsApp & Communication Automation',
    paramType: 'Control Parameter',
    description: 'Toggles full Meta WhatsApp Cloud API serverless webhook listener for natural text booking parsing.',
    uiWidget: 'toggle',
    target: 'app_config.enable_whatsapp_bot',
    role: 'Admin',
  },
  {
    key: 'reminder_lead_time_hours',
    name: 'Automated Reminder Lead Time',
    category: 'WhatsApp & Communication Automation',
    paramType: 'Control Parameter',
    description: 'Hours prior to appointment start time when an automated WhatsApp reminder text is dispatched.',
    uiWidget: 'select',
    options: [1, 2, 4, 24],
    target: 'app_config.reminder_lead_time_hours',
    role: 'Admin',
  },

  {
    key: 'restrict_out_of_stock_rx',
    name: 'Restrict Out-of-Stock Prescribing',
    category: 'Pharmacy & Inventory Safeguards',
    paramType: 'Control Parameter',
    description: 'Blocks doctors from selecting or prescribing medications that have zero available stock units.',
    uiWidget: 'toggle',
    target: 'app_config.restrict_out_of_stock_rx',
    role: 'Admin / Doctor',
  },
  {
    key: 'auto_deduct_inventory',
    name: 'Auto-Deduct Stock on Consultation Sign-off',
    category: 'Pharmacy & Inventory Safeguards',
    paramType: 'Control Parameter',
    description: 'Automatically subtracts prescribed medicine quantities from master inventory upon consultation completion.',
    uiWidget: 'toggle',
    target: 'app_config.auto_deduct_inventory',
    role: 'Admin',
  },
  {
    key: 'default_reorder_threshold',
    name: 'Default Low Stock Alert Threshold',
    category: 'Pharmacy & Inventory Safeguards',
    paramType: 'Functional Parameter',
    description: 'Global default unit count that triggers yellow warning badges in the pharmacy inventory UI.',
    uiWidget: 'number',
    min: 1,
    max: 100,
    target: 'inventory.default_reorder_threshold',
    role: 'Admin',
  },
  {
    key: 'currency_symbol',
    name: 'Display Currency Symbol',
    category: 'Pharmacy & Inventory Safeguards',
    paramType: 'Functional Parameter',
    description: 'Currency symbol used across inventory procurement, billing, and financial analytics UI.',
    uiWidget: 'select',
    options: ['₹ (INR)', '$ (USD)', 'AED', 'SAR'],
    target: 'app_config.currency_symbol',
    role: 'Admin',
  },

  {
    key: 'session_timeout_mins',
    name: 'Session Timeout Duration',
    category: 'System, Security & Data Privacy',
    paramType: 'Control Parameter',
    description: 'Inactivity duration before the Supabase authentication JWT session expires and requires re-login.',
    uiWidget: 'select',
    options: [15, 30, 60, 120],
    target: 'app_config.session_timeout_mins',
    role: 'Admin',
    isProvision: true,
  },
  {
    key: 'enable_pwa_offline',
    name: 'Enable PWA Offline Asset Caching',
    category: 'System, Security & Data Privacy',
    paramType: 'Control Parameter',
    description: 'Enables Progressive Web App service worker caching for offline form entries and fast UI loading.',
    uiWidget: 'toggle',
    target: 'app_config.enable_pwa_offline',
    role: 'Admin',
    isProvision: true,
  },
  {
    key: 'audit_log_level',
    name: 'Audit Logging Granularity',
    category: 'System, Security & Data Privacy',
    paramType: 'Control Parameter',
    description: 'Level of detail recorded in system audit logs for administrative, clinical, and inventory actions.',
    uiWidget: 'select',
    options: ['Minimal', 'Standard', 'Detailed'],
    target: 'app_config.audit_log_level',
    role: 'Admin',
    isProvision: true,
  },
  {
    key: 'rls_enforce_mode',
    name: 'Row-Level Security Enforce Mode',
    category: 'System, Security & Data Privacy',
    paramType: 'Control Parameter',
    description: 'Database security policy mode governing multi-role data access isolation in Supabase PostgreSQL.',
    uiWidget: 'select',
    options: ['Strict', 'Permissive'],
    target: 'app_config.rls_enforce_mode',
    role: 'Admin',
    isProvision: true,
  },
];
