import bcrypt from 'bcryptjs';
import { supabase } from './supabase';
import {
  DbDoctor,
  DbPatient,
  DbAppointment,
  DbInventory,
  DbPrescribedMedication,
  AppointmentWithPatient
} from '@/types/database';

export interface FormattedQueuePatient {
  id: string;
  patientDbId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone?: string;
  status: 'Waiting' | 'In Progress' | 'Completed';
  time: string;
  tokenNumber: number;
  patientNumber?: number;
  displayId?: string;
  priority?: 'Normal' | 'Urgent';
  scheduledTime: string;
}

export interface FormattedInventoryItem {
  id: string;
  generic: string;
  brand: string;
  stock: number;
  unit?: string;
  category?: string;
  unitPrice?: number;
  reorderThreshold?: number;
}

export async function getDoctors(): Promise<DbDoctor[]> {
  try {
    const { data, error } = await supabase.from('doctors').select('*');
    if (error) {
      console.warn('Error fetching doctors:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Doctors fetch exception:', err);
    return [];
  }
}

export interface VerifyDoctorPinResult {
  success: boolean;
  doctor?: DbDoctor;
  message?: string;
}

export async function verifyDoctorPin(
  pin: string,
  doctorId?: string
): Promise<VerifyDoctorPinResult> {
  const cleanPin = pin ? pin.trim() : '';
  if (!cleanPin) return { success: false, message: 'PIN is required' };

  try {
    let query = supabase
      .from('doctors')
      .select('id, auth_id, full_name, pin_code, failed_attempts, locked_until, pin_session_until, specialization, reg_no');

    if (doctorId) {
      query = query.eq('id', doctorId);
    }

    const { data: doctors, error } = await query;

    if (error || !doctors || doctors.length === 0) {
      console.warn('Doctor PIN check query error:', error?.message);
      return { success: false, message: 'No doctors found' };
    }

    // Cryptographically verify entered PIN against stored bcrypt hash in doctor table
    let matchedDoctor: DbDoctor | null = null;
    for (const doc of doctors) {
      if (doc.pin_code) {
        try {
          if (bcrypt.compareSync(cleanPin, doc.pin_code)) {
            matchedDoctor = doc;
            break;
          }
        } catch {
          // Ignore bcrypt salt parsing errors
        }
      }
    }

    if (!matchedDoctor) {
      // If doctorId was provided, increment failed attempts on that doctor
      if (doctorId && doctors.length > 0) {
        const doc = doctors[0];
        const currentFailed = (doc.failed_attempts || 0) + 1;
        const lockDurationMs = currentFailed >= 3 ? 15 * 60 * 1000 : 30 * 1000;
        const lockExpiry = new Date(Date.now() + lockDurationMs).toISOString();

        await supabase
          .from('doctors')
          .update({
            failed_attempts: currentFailed,
            locked_until: lockExpiry,
          })
          .eq('id', doc.id);
      }
      return { success: false, message: 'Invalid Security PIN' };
    }

    // Check if the matched doctor PIN entry is locked
    if (matchedDoctor.locked_until && new Date(matchedDoctor.locked_until).getTime() > Date.now()) {
      const waitSec = Math.ceil((new Date(matchedDoctor.locked_until).getTime() - Date.now()) / 1000);
      console.warn(`Doctor profile locked for ${waitSec}s`);
      return { success: false, message: `Account locked. Retry in ${waitSec}s` };
    }

    // Correct PIN: reset failed attempts, clear lock, open 30-minute PIN session
    const pinSessionUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase
      .from('doctors')
      .update({
        failed_attempts: 0,
        locked_until: null,
        pin_session_until: pinSessionUntil,
      })
      .eq('id', matchedDoctor.id);

    return {
      success: true,
      doctor: {
        ...matchedDoctor,
        pin_session_until: pinSessionUntil,
        failed_attempts: 0,
        locked_until: null,
      },
    };
  } catch (err) {
    console.warn('Doctor PIN check exception:', err);
    return { success: false, message: 'Error verifying PIN' };
  }
}

// Global Clinic & Doctor Authentication Result
export interface VerifyClinicAuthResult {
  success: boolean;
  type?: 'clinic' | 'doctor';
  role?: 'assistant' | 'doctor';
  doctor?: DbDoctor;
  message?: string;
}


export async function verifyClinicPin(
  pin: string
): Promise<{ success: boolean; message?: string }> {
  const cleanPin = pin ? pin.trim() : '';
  if (!cleanPin) return { success: false, message: 'Clinic PIN is required' };

  try {
    const { data, error } = await supabase.rpc('verify_clinic_pin', {
      p_pin: cleanPin,
    });
    if (!error && typeof data === 'boolean') {
      if (data === true) {
        return {
          success: true,
          message: 'Clinic Gateway Unlocked (8-Hour Session)',
        };
      }
      return { success: false, message: 'Invalid Clinic Security PIN' };
    }
    if (error) {
      console.warn('RPC verify_clinic_pin error:', error.message);
      return { success: false, message: error.message || 'Verification failed' };
    }
  } catch (err) {
    console.warn('RPC verify_clinic_pin exception:', err);
    return { success: false, message: 'Connection error verifying clinic PIN' };
  }

  return { success: false, message: 'Invalid Clinic Security PIN' };
}


export async function verifyClinicOrDoctorPin(
  pin: string
): Promise<VerifyClinicAuthResult> {
  const cleanPin = pin ? pin.trim() : '';
  if (!cleanPin) return { success: false, message: 'Security PIN is required' };

  // Tier 1: Check clinic gateway PIN dynamically via DB RPC
  const clinicRes = await verifyClinicPin(cleanPin);
  if (clinicRes.success) {
    return {
      success: true,
      type: 'clinic',
      role: 'assistant',
      message: clinicRes.message || 'Clinic Gateway Unlocked (8-Hour Session)',
    };
  }

  // Tier 2: Check doctor PIN dynamically via doctors table bcrypt
  const docResult = await verifyDoctorPin(cleanPin);
  if (docResult.success && docResult.doctor) {
    return {
      success: true,
      type: 'doctor',
      role: 'doctor',
      doctor: docResult.doctor,
      message: `Doctor Access Granted: ${docResult.doctor.full_name}`,
    };
  }

  return { success: false, message: 'Invalid Security PIN' };
}

const CLINIC_SESSION_KEY = 'healthsync_clinic_session';
const DOCTOR_SESSION_KEY = 'healthsync_active_doctor_session';

export interface ClinicSessionData {
  role: 'assistant' | 'doctor';
  name: string;
  expiresAt: number;
  doctorId?: string;
}

export function saveClinicSessionLocal(data: ClinicSessionData): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLINIC_SESSION_KEY, JSON.stringify(data));
    }
  } catch (err) {
    console.warn('Failed to save clinic session to localStorage:', err);
  }
}

export function getClinicSessionLocal(): ClinicSessionData | null {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(CLINIC_SESSION_KEY);
      if (!raw) return null;
      const parsed: ClinicSessionData = JSON.parse(raw);
      if (parsed && parsed.expiresAt && parsed.expiresAt > Date.now()) {
        return parsed;
      }
      localStorage.removeItem(CLINIC_SESSION_KEY);
    }
  } catch (err) {
    console.warn('Failed to read clinic session from localStorage:', err);
  }
  return null;
}

export function clearClinicSessionLocal(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CLINIC_SESSION_KEY);
    }
  } catch (err) {
    console.warn('Failed to clear clinic session from localStorage:', err);
  }
}

export interface DoctorSessionData {
  doctorId: string;
  name: string;
  title: string;
  expiresAt: number;
}

export function saveDoctorSessionLocal(data: DoctorSessionData): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DOCTOR_SESSION_KEY, JSON.stringify(data));
    }
  } catch (err) {
    console.warn('Failed to save session to localStorage:', err);
  }
}

export function getDoctorSessionLocal(): DoctorSessionData | null {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(DOCTOR_SESSION_KEY);
      if (!raw) return null;
      const parsed: DoctorSessionData = JSON.parse(raw);
      if (parsed && parsed.expiresAt && parsed.expiresAt > Date.now()) {
        return parsed;
      }
      localStorage.removeItem(DOCTOR_SESSION_KEY);
    }
  } catch (err) {
    console.warn('Failed to read session from localStorage:', err);
  }
  return null;
}

export function clearDoctorSessionLocal(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DOCTOR_SESSION_KEY);
    }
  } catch (err) {
    console.warn('Failed to clear session from localStorage:', err);
  }
}

export async function logoutDoctorSessionDb(doctorId?: string): Promise<void> {
  clearDoctorSessionLocal();
  try {
    if (doctorId) {
      await supabase
        .from('doctors')
        .update({ pin_session_until: null })
        .eq('id', doctorId);
    } else {
      await supabase
        .from('doctors')
        .update({ pin_session_until: null })
        .not('id', 'is', null);
    }
    await supabase.rpc('end_pin_session');
  } catch (err) {
    console.warn('Error clearing doctor session in Supabase:', err);
  }
}

export async function fetchQueueFromDb(): Promise<FormattedQueuePatient[]> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        doctor_id,
        scheduled_time,
        status,
        clinical_notes,
        visit_type,
        updated_at,
        patient:patients (
          id,
          full_name,
          age,
          gender,
          phone_number,
          created_at,
          patient_number,
          display_id
        )
      `)
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.warn('Error fetching queue from Supabase:', error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    return data.map((item: any, index: number) => {
      const patient = item.patient;
      const scheduledDate = item.scheduled_time ? new Date(item.scheduled_time) : new Date();
      const timeStr = scheduledDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const patNum = patient?.patient_number ?? (index + 1);
      const rawDispId = patient?.display_id;
      const displayId = rawDispId
        ? (rawDispId.startsWith('P') ? rawDispId : `P${rawDispId}`)
        : `P${String(patNum).padStart(3, '0')}`;

      return {
        id: item.id,
        patientDbId: item.patient_id,
        name: patient?.full_name || 'Walk-in Patient',
        age: patient?.age || 30,
        gender: (patient?.gender?.toLowerCase() === 'female' ? 'Female' : 'Male') as 'Male' | 'Female' | 'Other',
        phone: patient?.phone_number || undefined,
        status: (item.status as 'Waiting' | 'In Progress' | 'Completed') || 'Waiting',
        time: timeStr,
        tokenNumber: patNum,
        patientNumber: patNum,
        displayId,
        priority: item.visit_type === 'Urgent' ? 'Urgent' : 'Normal',
        scheduledTime: item.scheduled_time,
      };
    });
  } catch (err) {
    console.warn('Queue fetch exception:', err);
    return [];
  }
}

export async function registerWalkinPatientDb(params: {
  name: string;
  age: number;
  gender: string;
  phone?: string;
  priority?: 'Normal' | 'Urgent';
}): Promise<FormattedQueuePatient | null> {
  try {
    // 1. Phone number is required by NOT NULL constraint in Supabase (Section 3.2: Primary lookup key)
    const rawPhone = params.phone ? params.phone.trim() : '';
    const patientPhone = rawPhone.length > 0 ? rawPhone : `+91-WLK-${Date.now().toString().slice(-8)}`;

    let patientId: string | null = null;
    let patientName = params.name;
    let patientAge = params.age;
    let patientGender = params.gender;

    // Check if returning patient exists by phone number
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id, full_name, age, gender, phone_number, patient_number, display_id')
      .eq('phone_number', patientPhone)
      .maybeSingle();

    let patientNumber: number | undefined;
    let displayId: string | undefined;

    if (existingPatient) {
      patientId = existingPatient.id;
      patientName = existingPatient.full_name || params.name;
      patientAge = existingPatient.age || params.age;
      patientGender = existingPatient.gender || params.gender;
      patientNumber = existingPatient.patient_number || undefined;
      displayId = existingPatient.display_id
        ? (existingPatient.display_id.startsWith('P') ? existingPatient.display_id : `P${existingPatient.display_id}`)
        : undefined;
    } else {
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert([
          {
            full_name: params.name,
            age: params.age,
            gender: params.gender,
            phone_number: patientPhone,
          },
        ])
        .select('id, full_name, age, gender, phone_number, patient_number, display_id')
        .single();

      if (patientError || !patientData) {
        console.error('Error creating patient:', patientError);
        return null;
      }
      patientId = patientData.id;
      patientNumber = patientData.patient_number || undefined;
      displayId = patientData.display_id
        ? (patientData.display_id.startsWith('P') ? patientData.display_id : `P${patientData.display_id}`)
        : undefined;
    }

    // Fallback if patient_number wasn't returned
    let finalPatNumber = patientNumber;
    if (!finalPatNumber) {
      const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true });
      finalPatNumber = count || 1;
    }
    if (!displayId) {
      displayId = `P${String(finalPatNumber).padStart(3, '0')}`;
    }

    // 2. Fetch default doctor if available
    const { data: doctorData } = await supabase.from('doctors').select('id').limit(1);
    const doctorId = doctorData && doctorData.length > 0 ? doctorData[0].id : null;

    // 3. Insert appointment (visit_type must strictly satisfy check constraint: 'Walk-in', 'WhatsApp Link', 'WhatsApp Bot')
    const scheduledTime = new Date().toISOString();
    const clinicalNotes = params.priority === 'Urgent' ? '[URGENT TRIAGE]' : null;

    const { data: apptData, error: apptError } = await supabase
      .from('appointments')
      .insert([
        {
          patient_id: patientId,
          doctor_id: doctorId,
          scheduled_time: scheduledTime,
          status: 'Waiting',
          visit_type: 'Walk-in',
          clinical_notes: clinicalNotes,
        },
      ])
      .select()
      .single();

    if (apptError || !apptData) {
      console.error('Error creating appointment:', apptError?.message || apptError);
      return null;
    }

    const timeStr = new Date(scheduledTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    if (!patientId) {
      console.error('Missing patient ID after registration');
      return null;
    }

    return {
      id: apptData.id,
      patientDbId: patientId,
      name: patientName,
      age: patientAge,
      gender: (patientGender as any) || 'Male',
      phone: patientPhone,
      status: 'Waiting',
      time: timeStr,
      tokenNumber: finalPatNumber,
      patientNumber: finalPatNumber,
      displayId,
      priority: params.priority || 'Normal',
      scheduledTime,
    };
  } catch (err) {
    console.error('Failed to register patient in DB:', err);
    return null;
  }
}

export async function reallocateSlotDb(appointmentId: string): Promise<string | null> {
  try {
    // Look up current time
    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('scheduled_time')
      .eq('id', appointmentId)
      .single();

    const oldTime = currentAppt?.scheduled_time || new Date().toISOString();
    const newDate = new Date(Date.now() + 20 * 60000);
    const newTimeIso = newDate.toISOString();

    // Update appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        scheduled_time: newTimeIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.warn('Error reallocating appointment slot:', updateError);
      return null;
    }

    // Log to appointment_logs
    await supabase.from('appointment_logs').insert([
      {
        appointment_id: appointmentId,
        old_time: oldTime,
        new_time: newTimeIso,
        reason: 'Staff reallocated 20 minutes delay',
      },
    ]);

    return newDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (err) {
    console.warn('Reallocate exception:', err);
    return null;
  }
}

export async function updateAppointmentStatusDb(
  appointmentId: string,
  status: 'Waiting' | 'In Progress' | 'Completed'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('appointments')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (error) {
      console.warn('Error updating appointment status:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Status update exception:', err);
    return false;
  }
}

export async function completeConsultationDb(params: {
  appointmentId: string;
  notes?: string;
  prescriptions: Array<{ inventoryId: string | number; qty: number }>;
}): Promise<boolean> {
  try {
    // 1. Update appointment to Completed with clinical notes
    const { error: apptError } = await supabase
      .from('appointments')
      .update({
        status: 'Completed',
        clinical_notes: params.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.appointmentId);

    if (apptError) {
      console.warn('Error completing appointment:', apptError);
    }

    // 2. Insert prescribed medications & deduct inventory stock
    for (const rx of params.prescriptions) {
      // Record prescription
      await supabase.from('prescribed_medications').insert([
        {
          appointment_id: params.appointmentId,
          inventory_id: rx.inventoryId,
          dispensed_quantity: rx.qty,
        },
      ]);

      // Deduct from inventory
      const { data: invItem } = await supabase
        .from('inventory')
        .select('stock_quantity')
        .eq('id', rx.inventoryId)
        .single();

      if (invItem) {
        const newStock = Math.max(0, (invItem.stock_quantity || 0) - rx.qty);
        await supabase
          .from('inventory')
          .update({
            stock_quantity: newStock,
            last_updated: new Date().toISOString(),
          })
          .eq('id', rx.inventoryId);
      }
    }

    return true;
  } catch (err) {
    console.error('Error completing consultation in DB:', err);
    return false;
  }
}

export async function fetchInventoryFromDb(): Promise<FormattedInventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('generic_name', { ascending: true });

    if (error) {
      console.warn('Error fetching inventory from Supabase:', error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    return data.map((item: DbInventory) => ({
      id: item.id,
      generic: item.generic_name,
      brand: item.brand_name,
      stock: item.stock_quantity,
      unit: 'Units',
      category: 'General',
      unitPrice: item.unit_price,
      reorderThreshold: item.reorder_threshold,
    }));
  } catch (err) {
    console.warn('Inventory fetch exception:', err);
    return [];
  }
}

export async function addInventoryItemDb(params: {
  generic: string;
  brand: string;
  stock: number;
  reorderThreshold?: number;
  unitPrice?: number;
}): Promise<FormattedInventoryItem | null> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .insert([
        {
          generic_name: params.generic,
          brand_name: params.brand,
          stock_quantity: params.stock,
          reorder_threshold: params.reorderThreshold || 15,
          unit_price: params.unitPrice || 0,
          last_updated: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error('Error adding inventory item:', error);
      return null;
    }

    return {
      id: data.id,
      generic: data.generic_name,
      brand: data.brand_name,
      stock: data.stock_quantity,
      unit: 'Units',
      category: 'General',
      unitPrice: data.unit_price,
      reorderThreshold: data.reorder_threshold,
    };
  } catch (err) {
    console.error('Add inventory exception:', err);
    return null;
  }
}

export async function restockInventoryItemDb(
  id: string | number,
  addedQty: number
): Promise<number | null> {
  try {
    const { data: current } = await supabase
      .from('inventory')
      .select('stock_quantity')
      .eq('id', id)
      .single();

    const newStock = ((current?.stock_quantity) || 0) + addedQty;

    const { error } = await supabase
      .from('inventory')
      .update({
        stock_quantity: newStock,
        last_updated: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.warn('Error restocking item in Supabase:', error);
      return null;
    }

    return newStock;
  } catch (err) {
    console.warn('Restock exception:', err);
    return null;
  }
}

export function subscribeToClinicUpdates(onUpdate: () => void) {
  const channelName = `clinic_realtime_${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
      onUpdate();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
      onUpdate();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
      onUpdate();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, () => {
      onUpdate();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ====================================================================
// APPLICATION SETTINGS & PARAMETER CATALOG SERVICES
// ====================================================================

import { AppConfig, DEFAULT_APP_CONFIG } from '@/data/default-config';

const APP_CONFIG_STORAGE_KEY = 'healthsync_app_config';

export function getAppConfigLocal(): AppConfig {
  if (typeof window === 'undefined') return DEFAULT_APP_CONFIG;
  try {
    const raw = localStorage.getItem(APP_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_CONFIG;
    return { ...DEFAULT_APP_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APP_CONFIG;
  }
}

export function saveAppConfigLocal(config: AppConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APP_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed saving app config locally:', e);
  }
}

export async function fetchAppConfigDb(): Promise<AppConfig> {
  const localConfig = getAppConfigLocal();
  try {
    const [configRes, docRes] = await Promise.all([
      supabase.from('app_config').select('key, value'),
      supabase.from('doctors').select('daily_quota').limit(1),
    ]);

    const rows = configRes.data;
    if (!rows || rows.length === 0) {
      return localConfig;
    }

    const merged: Record<string, unknown> = { ...localConfig };
    rows.forEach((row) => {
      let val: unknown = row.value;
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch {
          // keep as string
        }
      }
      merged[row.key] = val;
    });

    const booleanKeys: (keyof AppConfig)[] = [
      'allow_quota_override',
      'require_doctor_pin',
      'auto_move_unattended',
      'enable_whatsapp_autoresponder',
      'enable_whatsapp_bot',
      'restrict_out_of_stock_rx',
      'auto_deduct_inventory',
      'enable_pwa_offline',
    ];
    booleanKeys.forEach((k) => {
      if (merged[k] !== undefined) {
        const raw = merged[k];
        if (typeof raw === 'string') {
          merged[k] = raw.trim().toLowerCase() === 'true';
        } else {
          merged[k] = Boolean(raw);
        }
      }
    });

    const doctorQuota = docRes.data?.[0]?.daily_quota;
    if (doctorQuota !== undefined) {
      merged.daily_quota = Number(doctorQuota);
    }

    const fullConfig = { ...DEFAULT_APP_CONFIG, ...merged } as AppConfig;
    saveAppConfigLocal(fullConfig);
    return fullConfig;
  } catch (err) {
    console.warn('Error fetching app_config from Supabase, using local:', err);
    return localConfig;
  }
}

export async function updateAppConfigDb(
  updates: Partial<AppConfig>
): Promise<{ success: boolean; config: AppConfig; error?: string }> {
  const current = getAppConfigLocal();
  const nextConfig: AppConfig = { ...current, ...updates };

  // Save to local storage for instant optimistic UI update
  saveAppConfigLocal(nextConfig);

  try {
    // 1. Update app_config table by primary key `key`
    const updatePromises = Object.entries(updates).map(async ([key, val]) => {
      let serializedValue: string;
      if (typeof val === 'boolean') {
        serializedValue = val ? 'true' : 'false';
      } else if (typeof val === 'object' && val !== null) {
        serializedValue = JSON.stringify(val);
      } else {
        serializedValue = String(val);
      }

      const { error } = await supabase
        .from('app_config')
        .upsert(
          {
            key,
            value: serializedValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

      if (error) {
        // Fallback to direct update
        await supabase
          .from('app_config')
          .update({ value: serializedValue })
          .eq('key', key);
      }
    });

    await Promise.all(updatePromises);

    // 2. Sync doctor daily quota to doctors table if modified
    if (updates.daily_quota !== undefined) {
      const { error: docError } = await supabase
        .from('doctors')
        .update({ daily_quota: updates.daily_quota })
        .not('id', 'is', null);

      if (docError) {
        console.warn('Doctors quota update notice:', docError.message);
      }
    }

    return { success: true, config: nextConfig };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('Exception updating app_config in Supabase:', err);
    return { success: true, config: nextConfig, error: errorMsg };
  }
}

export async function resetAppConfigDb(): Promise<AppConfig> {
  saveAppConfigLocal(DEFAULT_APP_CONFIG);
  try {
    await updateAppConfigDb(DEFAULT_APP_CONFIG);
  } catch (err) {
    console.warn('Exception resetting app_config:', err);
  }
  return DEFAULT_APP_CONFIG;
}

export async function searchPatientsDb(query: string): Promise<DbPatient[]> {
  try {
    const raw = query.trim();
    if (!raw) return [];
    const q = raw.toLowerCase();

    let request = supabase
      .from('patients')
      .select('id, full_name, age, gender, phone_number, created_at')
      .limit(40);

    // 1. Age range query - e.g. "between 20 and 50", "20-50", "20 to 50"
    const rangeMatch = q.match(/(\d+)\s*(?:-|to|and)\s*(\d+)/i);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      request = request.gte('age', min).lte('age', max).order('age', { ascending: true });
      if (q.includes('female')) {
        request = request.ilike('gender', 'Female');
      } else if (q.includes('male')) {
        request = request.ilike('gender', 'Male');
      }
      const { data, error } = await request;
      if (!error && data) return data;
    }

    // 2. Senior / greater than match - e.g. ">= 60", "> 40", "60+", "above 60", "senior"
    const gtMatch = q.match(/(?:>=|>|above)\s*(\d+)|\b(\d+)\s*\+/i);
    if (gtMatch || q.includes('senior') || q.includes('elderly')) {
      const min = gtMatch ? parseInt(gtMatch[1] || gtMatch[2], 10) : 60;
      request = request.gte('age', min).order('age', { ascending: false });
      if (q.includes('female')) {
        request = request.ilike('gender', 'Female');
      } else if (q.includes('male')) {
        request = request.ilike('gender', 'Male');
      }
      const { data, error } = await request;
      if (!error && data) return data;
    }

    // 3. Pediatric / under match - e.g. "< 18", "<= 18", "under 18", "pediatric"
    const ltMatch = q.match(/(?:<=|<|under)\s*(\d+)/i);
    if (ltMatch || q.includes('pediatric') || q.includes('child')) {
      const max = ltMatch ? parseInt(ltMatch[1], 10) : 18;
      request = request.lt('age', max).order('age', { ascending: true });
      if (q.includes('female')) {
        request = request.ilike('gender', 'Female');
      } else if (q.includes('male')) {
        request = request.ilike('gender', 'Male');
      }
      const { data, error } = await request;
      if (!error && data) return data;
    }

    // 4. Standalone Gender queries - e.g. "female" or "male"
    if (q === 'female' || q === 'females' || q === 'women' || q === 'woman') {
      const { data, error } = await request.ilike('gender', 'Female').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    if (q === 'male' || q === 'males' || q === 'men' || q === 'man') {
      const { data, error } = await request.ilike('gender', 'Male').order('created_at', { ascending: false });
      if (!error && data) return data;
    }

    // 5. Gender with exact age - e.g. "female 45" or "male 30"
    const genderAgeMatch = q.match(/(female|male)\s*(\d+)/i);
    if (genderAgeMatch) {
      const genderStr = genderAgeMatch[1].toLowerCase() === 'female' ? 'Female' : 'Male';
      const exactAge = parseInt(genderAgeMatch[2], 10);
      const { data, error } = await request.ilike('gender', genderStr).eq('age', exactAge);
      if (!error && data) return data;
    }

    // 6. Default: Exact Age, Name substring (ilike), or Phone substring (like)
    const isNum = /^\d+$/.test(raw);
    const numVal = isNum ? parseInt(raw, 10) : null;

    if (isNum && numVal !== null && numVal <= 120) {
      request = request.or(`full_name.ilike.%${raw}%,phone_number.ilike.%${raw}%,age.eq.${numVal}`);
    } else {
      request = request.or(`full_name.ilike.%${raw}%,phone_number.ilike.%${raw}%,gender.ilike.%${raw}%`);
    }

    const { data, error } = await request;
    if (error) {
      console.warn('Error querying patients in Supabase:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Exception searching patients in Supabase:', err);
    return [];
  }
}

