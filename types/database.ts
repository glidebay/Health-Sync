export interface DbDoctor {
  id: string;
  auth_id?: string | null;
  full_name: string;
  daily_quota?: number;
  created_at?: string;
  pin_code?: string | null;
  failed_attempts?: number;
  locked_until?: string | null;
  pin_session_until?: string | null;
  specialization?: string | null;
  reg_no?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean;
  clinic_id?: string | null;
  clinic_name?: string | null;
  is_admin?: boolean;
  is_admin_doctor?: boolean;
  is_deleted?: boolean;
}

export interface DbDoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  is_active: boolean;
}

export interface DbStaff {
  id: string;
  auth_id?: string | null;
  full_name: string;
  role: string;
  location_id?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  pin_code?: string | null;
  is_active?: boolean;
}

export interface DbClinicLocation {
  id: string;
  clinic_id?: string | null;
  clinic_name?: string | null;
  branch_name: string;
  branch_code?: string | null;
  gateway_pin?: string | null;
  address?: string | null;
  address_line1?: string | null;
  landmark?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  rx_footer_text?: string | null;
  whatsapp_phone_number_id?: string | null;
  whatsapp_display_number?: string | null;
  whatsapp_waba_id?: string | null;
  welcome_message?: string | null;
  daily_quota?: number | null;
  slot_duration_mins?: number | null;
  is_active?: boolean;
  created_at?: string;
}

export interface DbDoctorLocation {
  id: string;
  doctor_id: string;
  location_id: string;
  consultation_days?: number[];
  daily_quota?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface DbPatient {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  phone_number?: string | null;
  created_at?: string;
  patient_number?: number | null;
  display_id?: string | null;
}

export interface DbAppointment {
  id: string;
  patient_id: string;
  doctor_id?: string | null;
  scheduled_time: string;
  status: 'Waiting' | 'In Progress' | 'Completed' | 'Cancelled';
  clinical_notes?: string | null;
  visit_type?: string | null;
  location_id?: string | null;
  updated_at?: string;
}

export interface DbInventory {
  id: string;
  generic_name: string;
  brand_name: string;
  stock_quantity: number;
  location_id?: string | null;
  last_updated?: string;
  reorder_threshold?: number;
  unit_price?: number;
}

export interface DbPrescribedMedication {
  id: string;
  appointment_id: string;
  inventory_id: string;
  dispensed_quantity: number;
}

export interface DbWhatsappRequest {
  id: string;
  phone_number: string;
  patient_name?: string | null;
  preferred_date?: string | null;
  status: string;
  raw_payload?: Record<string, any> | null;
  created_at?: string;
}

export interface DbAppointmentLog {
  id: string;
  appointment_id: string;
  old_time?: string | null;
  new_time?: string | null;
  changed_by_staff_id?: string | null;
  reason?: string | null;
  logged_at?: string;
}

export interface AppointmentWithPatient extends DbAppointment {
  patient?: DbPatient;
  doctor?: DbDoctor;
}
