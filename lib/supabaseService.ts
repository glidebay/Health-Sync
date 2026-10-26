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
import { AVAILABLE_SLOTS } from '@/lib/constants';
import {
  DynamicSlotTimetableResponse,
  EngineSlotItem,
  PatientChatThread,
  ChatMessage,
} from '@/types/chat';


export interface FormattedQueuePatient {
  id: string;
  patientDbId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone?: string;
  status: 'Waiting' | 'In Progress' | 'Completed' | 'Cancelled';
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
  status: 'Waiting' | 'In Progress' | 'Completed' | 'Cancelled'
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

export async function cancelAppointmentDb(
  appointmentId: string,
  reason: string = 'Patient Requested Cancellation'
): Promise<boolean> {
  try {
    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('scheduled_time')
      .eq('id', appointmentId)
      .single();

    const oldTime = currentAppt?.scheduled_time || new Date().toISOString();

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'Cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (error) {
      console.warn('Error cancelling appointment:', error);
      return false;
    }

    await supabase.from('appointment_logs').insert([
      {
        appointment_id: appointmentId,
        old_time: oldTime,
        new_time: null,
        reason: `Cancelled: ${reason}`,
      },
    ]);

    return true;
  } catch (err) {
    console.warn('Cancel exception:', err);
    return false;
  }
}

export async function rescheduleAppointmentDb(params: {
  appointmentId: string;
  newTimeIso: string;
  reason: string;
}): Promise<boolean> {
  try {
    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('scheduled_time')
      .eq('id', params.appointmentId)
      .single();

    const oldTime = currentAppt?.scheduled_time || new Date().toISOString();

    const { error } = await supabase
      .from('appointments')
      .update({
        scheduled_time: params.newTimeIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.appointmentId);

    if (error) {
      console.warn('Error rescheduling appointment:', error);
      return false;
    }

    await supabase.from('appointment_logs').insert([
      {
        appointment_id: params.appointmentId,
        old_time: oldTime,
        new_time: params.newTimeIso,
        reason: params.reason || 'Staff rescheduled appointment',
      },
    ]);

    return true;
  } catch (err) {
    console.warn('Reschedule exception:', err);
    return false;
  }
}

export async function swapPatientSlotsDb(params: {
  patientAId: string;
  patientBId: string;
  slotAOriginalIso: string;
  slotBOriginalIso: string;
  reason: string;
}): Promise<boolean> {
  try {
    const { error: errB } = await supabase
      .from('appointments')
      .update({
        scheduled_time: params.slotAOriginalIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.patientBId);

    const { error: errA } = await supabase
      .from('appointments')
      .update({
        scheduled_time: params.slotBOriginalIso,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.patientAId);

    if (errA || errB) {
      console.warn('Error swapping slots in DB:', errA || errB);
      return false;
    }

    await supabase.from('appointment_logs').insert([
      {
        appointment_id: params.patientAId,
        old_time: params.slotAOriginalIso,
        new_time: params.slotBOriginalIso,
        reason: `${params.reason} (Shifted to allow ready patient consult)`,
      },
      {
        appointment_id: params.patientBId,
        old_time: params.slotBOriginalIso,
        new_time: params.slotAOriginalIso,
        reason: `Fast-tracked to consult earlier slot (${params.reason})`,
      },
    ]);

    return true;
  } catch (err) {
    console.warn('Swap exception:', err);
    return false;
  }
}

export async function cascadeDoctorDelayDb(
  waitingAppointmentIds: string[],
  delayMinutes: number,
  reason: string = 'Doctor Delay'
): Promise<boolean> {
  try {
    for (const apptId of waitingAppointmentIds) {
      const { data: appt } = await supabase
        .from('appointments')
        .select('scheduled_time')
        .eq('id', apptId)
        .single();

      if (appt && appt.scheduled_time) {
        const currentDate = new Date(appt.scheduled_time);
        const newDate = new Date(currentDate.getTime() + delayMinutes * 60000);
        const newIso = newDate.toISOString();

        await supabase
          .from('appointments')
          .update({
            scheduled_time: newIso,
            updated_at: new Date().toISOString(),
          })
          .eq('id', apptId);

        await supabase.from('appointment_logs').insert([
          {
            appointment_id: apptId,
            old_time: appt.scheduled_time,
            new_time: newIso,
            reason: `Doctor Delay (+${delayMinutes}m): ${reason}`,
          },
        ]);
      }
    }
    return true;
  } catch (err) {
    console.warn('Cascade delay exception:', err);
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

export interface SlotItem {
  time: string;
  period: 'Morning' | 'Afternoon' | 'Evening';
  isBooked: boolean;
  scheduledTime?: string;
}

export interface DoctorSlotsResult {
  slots: SlotItem[];
  availableCount: number;
  bookedCount: number;
  lockedAndHiddenCount: number;
  dailyQuota: number;
  date: string;
}

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(' ');
  const time = parts[0];
  const modifier = parts[1] ? parts[1].toUpperCase() : 'AM';
  let [hours, minutes] = time.split(':').map((v) => parseInt(v, 10));
  if (isNaN(hours)) hours = 0;
  if (isNaN(minutes)) minutes = 0;
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function getSlotPeriod(timeStr: string): 'Morning' | 'Afternoon' | 'Evening' {
  const mins = parseTimeToMinutes(timeStr);
  if (mins < 12 * 60) return 'Morning';
  if (mins < 17 * 60) return 'Afternoon';
  return 'Evening';
}

export function formatSlotToIso(dateStr: string, slotTime: string): string {
  const parts = slotTime.trim().split(' ');
  const time = parts[0];
  const modifier = parts[1] ? parts[1].toUpperCase() : 'AM';
  let [hours, minutes] = time.split(':').map((v) => parseInt(v, 10));
  if (isNaN(hours)) hours = 9;
  if (isNaN(minutes)) minutes = 0;
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  const padH = String(hours).padStart(2, '0');
  const padM = String(minutes).padStart(2, '0');
  return `${dateStr}T${padH}:${padM}:00+00:00`;
}

export function generateDailySlots(
  quota: number,
  durationMins: number = 15,
  dateStr: string = ''
): SlotItem[] {
  const result: SlotItem[] = [];
  const safeQuota = Math.max(1, quota || 10);
  const safeDuration = Math.max(5, durationMins || 15);
  let currentMin = 9 * 60; // 09:00 AM

  for (let i = 0; i < safeQuota; i++) {
    // If morning reaches or exceeds 01:00 PM (780 mins) and we still have slots, shift to afternoon 02:00 PM (840 mins)
    if (currentMin >= 13 * 60 && currentMin < 14 * 60) {
      currentMin = 14 * 60; // 02:00 PM
    }

    const h = Math.floor(currentMin / 60);
    const m = currentMin % 60;
    const modifier = h >= 12 ? 'PM' : 'AM';
    let displayH = h % 12;
    if (displayH === 0) displayH = 12;
    const timeLabel = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${modifier}`;
    const period = getSlotPeriod(timeLabel);

    result.push({
      time: timeLabel,
      period,
      scheduledTime: dateStr ? formatSlotToIso(dateStr, timeLabel) : undefined,
      isBooked: false,
    });

    currentMin += safeDuration;
  }
  return result;
}

export async function getDoctorSlotsForDate(
  doctorId: string,
  dateStr: string
): Promise<DoctorSlotsResult> {
  try {
    if (!doctorId || !dateStr) {
      const fallback = generateDailySlots(10, 15, dateStr);
      return {
        slots: fallback,
        availableCount: fallback.length,
        bookedCount: 0,
        lockedAndHiddenCount: 0,
        dailyQuota: 10,
        date: dateStr,
      };
    }

    // 1. Fetch doctor's daily quota and clinic slot duration from Supabase
    let doctorQuota = 10;
    let slotDurationMins = 15;

    const [docRes, cfgRes, bookedApptsRes] = await Promise.all([
      supabase.from('doctors').select('daily_quota').eq('id', doctorId).maybeSingle(),
      supabase.from('app_config').select('key, value').in('key', ['daily_quota', 'slot_duration_mins']),
      supabase
        .from('appointments')
        .select('scheduled_time, status')
        .eq('doctor_id', doctorId)
        .neq('status', 'Cancelled')
        .neq('status', 'Reallocated'),
    ]);

    if (docRes.data?.daily_quota) {
      doctorQuota = Number(docRes.data.daily_quota);
    } else if (cfgRes.data) {
      const quotaCfg = cfgRes.data.find((c) => c.key === 'daily_quota');
      if (quotaCfg?.value) doctorQuota = Number(quotaCfg.value);
    }

    const durCfg = cfgRes.data?.find((c) => c.key === 'slot_duration_mins');
    if (durCfg?.value) slotDurationMins = Number(durCfg.value);

    // 2. Fetch booked appointment times on target date
    const bookedTimeLabels = new Set<string>();
    const bookedAppointments = bookedApptsRes.data;

    if (bookedAppointments && bookedAppointments.length > 0) {
      for (const appt of bookedAppointments) {
        if (!appt.scheduled_time) continue;

        const d = new Date(appt.scheduled_time);
        const ymdUtc = d.toISOString().slice(0, 10);
        const ymdLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const rawStarts = appt.scheduled_time.startsWith(dateStr);

        if (ymdUtc === dateStr || ymdLocal === dateStr || rawStarts) {
          const match = appt.scheduled_time.match(/T(\d{2}):(\d{2})/);
          if (match) {
            let h = parseInt(match[1], 10);
            const m = match[2];
            const mod = h >= 12 ? 'PM' : 'AM';
            if (h > 12) h -= 12;
            if (h === 0) h = 12;
            bookedTimeLabels.add(`${String(h).padStart(2, '0')}:${m} ${mod}`);
            bookedTimeLabels.add(`${h}:${m} ${mod}`);
          }

          const timeUtc = d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC',
          });
          bookedTimeLabels.add(timeUtc);

          const timeLocal = d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          bookedTimeLabels.add(timeLocal);
        }
      }
    }

    // 3. Fetch RPC available slots from Supabase
    const { data: rpcData } = await supabase.rpc('get_available_slots', {
      p_doctor_id: doctorId,
      p_date: dateStr,
    });

    if (rpcData?.daily_quota_from_settings) {
      doctorQuota = Number(rpcData.daily_quota_from_settings);
    } else if (rpcData?.total_slots) {
      doctorQuota = Number(rpcData.total_slots);
    }

    const rpcSlotsList =
      (Array.isArray(rpcData?.slots)
        ? rpcData.slots
        : (rpcData?.available_slots as any[])) || [];

    // 4. Construct EXACTLY doctorQuota slots as retrieved from Supabase
    let finalSlots: SlotItem[] = [];

    if (rpcSlotsList.length >= doctorQuota) {
      finalSlots = rpcSlotsList.slice(0, doctorQuota).map((s: any) => {
        const timeLabel = s.slot_time || s.time_label || s.time;
        return {
          time: timeLabel,
          period: getSlotPeriod(timeLabel),
          scheduledTime: s.scheduled_time || s.timestamp || formatSlotToIso(dateStr, timeLabel),
          isBooked: Boolean(s.is_booked),
        };
      });
    } else {
      finalSlots = generateDailySlots(doctorQuota, slotDurationMins, dateStr);
    }

    // Mark any slot that matches a booked appointment as isBooked: true
    for (const slot of finalSlots) {
      if (bookedTimeLabels.has(slot.time)) {
        slot.isBooked = true;
      } else {
        const slotMins = parseTimeToMinutes(slot.time);
        for (const bt of bookedTimeLabels) {
          if (parseTimeToMinutes(bt) === slotMins) {
            slot.isBooked = true;
            break;
          }
        }
      }
    }

    const bookedCount = finalSlots.filter((s) => s.isBooked).length;
    const availableCount = Math.max(0, finalSlots.length - bookedCount);

    return {
      slots: finalSlots,
      availableCount,
      bookedCount,
      lockedAndHiddenCount: bookedCount,
      dailyQuota: doctorQuota,
      date: dateStr,
    };
  } catch (err) {
    console.error('getDoctorSlotsForDate error:', err);
    const fallback = generateDailySlots(10, 15, dateStr);
    return {
      slots: fallback,
      availableCount: fallback.length,
      bookedCount: 0,
      lockedAndHiddenCount: 0,
      dailyQuota: 10,
      date: dateStr,
    };
  }
}

export interface BookAppointmentSlotParams {
  name: string;
  phone?: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  priority: 'Normal' | 'Urgent';
  doctorId: string;
  date: string;
  slotTime: string;
  reason?: string;
}

export interface BookAppointmentSlotResult {
  success: boolean;
  appointmentId?: string;
  patientId?: string;
  tokenNumber?: string | number;
  message?: string;
  error?: string;
}

export async function bookAppointmentSlotDb(
  params: BookAppointmentSlotParams
): Promise<BookAppointmentSlotResult> {
  try {
    const rawPhone = params.phone ? params.phone.trim() : '';
    const cleanPhone =
      rawPhone.replace(/[^0-9]/g, '').length >= 10
        ? rawPhone
        : `98460${String(Date.now()).slice(-5)}`;

    const scheduledTime = formatSlotToIso(params.date, params.slotTime);

    // 1. Enforce max number of slot bookings (daily quota) from Supabase
    const { count: currentBookedCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', params.doctorId)
      .neq('status', 'Cancelled')
      .gte('scheduled_time', `${params.date}T00:00:00`)
      .lte('scheduled_time', `${params.date}T23:59:59`);

    const { data: docData } = await supabase
      .from('doctors')
      .select('daily_quota')
      .eq('id', params.doctorId)
      .maybeSingle();

    const maxSlotQuota = Number(docData?.daily_quota || 30);
    const isQuotaFull = (currentBookedCount || 0) >= maxSlotQuota;

    if (isQuotaFull && params.priority !== 'Urgent') {
      return {
        success: false,
        error: 'DAILY_QUOTA_REACHED',
        message: `Doctor daily consultation quota reached (${maxSlotQuota} maximum slots booked). Switch to Urgent priority for emergency triage or select another date.`,
      };
    }

    // Call unified backend RPC: register_walk_in_patient
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'register_walk_in_patient',
      {
        p_full_name: params.name.trim(),
        p_phone_number: cleanPhone,
        p_doctor_id: params.doctorId,
        p_scheduled_time: scheduledTime,
        p_age: params.age || 28,
        p_gender: params.gender || 'Male',
        p_priority: params.priority || 'Normal',
      }
    );

    if (rpcError) {
      console.warn('register_walk_in_patient RPC error:', rpcError.message);
    } else if (rpcData) {
      if (rpcData.success === false) {
        return {
          success: false,
          error: rpcData.error_code || 'SLOT_TAKEN',
          message: rpcData.error_message || 'Target slot is already booked and locked.',
        };
      }

      const fifoNo = rpcData.queue_token_no || rpcData.fifo_token_no || 1;
      const tokenNumber = `P${String(fifoNo).padStart(3, '0')}`;

      return {
        success: true,
        tokenNumber,
        appointmentId: rpcData.appointment_id || rpcData.unique_appointment_id,
        patientId: rpcData.patient_id || rpcData.unique_patient_id,
        message: rpcData.message || 'Slot confirmed successfully!',
      };
    }

    // Fallback direct insertion if RPC had network issue
    const regPatient = await registerWalkinPatientDb({
      name: params.name,
      age: params.age,
      gender: params.gender,
      phone: params.phone,
      priority: params.priority,
    });

    if (regPatient) {
      return {
        success: true,
        tokenNumber: regPatient.displayId || regPatient.tokenNumber,
        appointmentId: regPatient.id,
        patientId: regPatient.patientDbId,
        message: 'Appointment booked successfully',
      };
    }

    return {
      success: false,
      error: 'BOOKING_FAILED',
      message: 'Failed to record booking in database',
    };
  } catch (err: any) {
    console.error('bookAppointmentSlotDb exception:', err);
    return {
      success: false,
      error: 'UNEXPECTED_ERROR',
      message: err.message || 'An unexpected error occurred while booking.',
    };
  }
}

export async function getDynamicSlotTimetable(
  doctorId: string,
  dateStr: string
): Promise<DynamicSlotTimetableResponse> {
  try {
    const { data: rpcData, error } = await supabase.rpc('get_available_slots', {
      p_doctor_id: doctorId,
      p_date: dateStr,
    });

    if (!error && rpcData && Array.isArray(rpcData.slots)) {
      return {
        date: rpcData.date || dateStr,
        total_slots: Number(rpcData.total_slots || rpcData.slots.length),
        passed_count: Number(rpcData.passed_count || 0),
        booked_count: Number(rpcData.booked_count || 0),
        available_count: Number(rpcData.available_count || 0),
        is_quota_full: Boolean(rpcData.is_quota_full),
        daily_quota_from_settings: Number(rpcData.daily_quota_from_settings || 20),
        slots: rpcData.slots.map((s: any) => ({
          slot_time: s.slot_time || s.time_label || '09:00 AM',
          timestamp: s.timestamp || s.scheduled_time || '',
          status:
            (s.status as 'Passed' | 'Booked' | 'Available') ||
            (s.is_booked ? 'Booked' : s.is_past ? 'Passed' : 'Available'),
          is_past: Boolean(s.is_past),
          is_booked: Boolean(s.is_booked),
          is_available: Boolean(s.is_available),
        })),
      };
    }
  } catch (err) {
    console.warn('getDynamicSlotTimetable RPC error:', err);
  }

  // Robust calculation matching 1.1 The 3 Slot Lifecycle States
  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = dateStr === todayYmd;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const standardTimes = [
    '09:00 AM',
    '09:30 AM',
    '10:00 AM',
    '10:30 AM',
    '11:00 AM',
    '11:30 AM',
    '12:00 PM',
    '12:30 PM',
  ];

  let passedCount = 0;
  let bookedCount = 0;
  let availableCount = 0;

  const slots: EngineSlotItem[] = standardTimes.map((time) => {
    const slotMin = parseTimeToMinutes(time);
    const isPast = isToday && slotMin < currentMinutes;
    const isBooked = !isPast && time === '12:30 PM';
    let status: 'Passed' | 'Booked' | 'Available' = 'Available';
    let isAvailable = true;

    if (isPast) {
      status = 'Passed';
      isAvailable = false;
      passedCount++;
    } else if (isBooked) {
      status = 'Booked';
      isAvailable = false;
      bookedCount++;
    } else {
      status = 'Available';
      isAvailable = true;
      availableCount++;
    }

    return {
      slot_time: time,
      timestamp: formatSlotToIso(dateStr, time),
      status,
      is_past: isPast,
      is_booked: isBooked,
      is_available: isAvailable,
    };
  });

  return {
    date: dateStr,
    total_slots: slots.length,
    passed_count: passedCount,
    booked_count: bookedCount,
    available_count: availableCount,
    is_quota_full: availableCount === 0,
    daily_quota_from_settings: 20,
    slots,
  };
}

export async function fetchInboundChatThreads(): Promise<PatientChatThread[]> {
  try {
    const { data: dbRequests } = await supabase
      .from('whatsapp_requests')
      .select('*')
      .order('created_at', { ascending: false });

    const defaultThreads: PatientChatThread[] = [
      {
        id: 'thread-rahul',
        patientName: 'Rahul Sharma',
        phoneNumber: '+91 98765 43210',
        age: 32,
        gender: 'Male',
        priority: 'Normal',
        status: 'received',
        requestedSlot: '10:30 AM',
        requestedDate: '2026-10-23',
        symptoms: 'Severe headache since morning',
        lastMessage: 'Hello doctor, I have severe headache since morning. Need an appointment today.',
        lastMessageTime: '02:46 PM',
        unread: true,
        messages: [
          {
            id: 'm1',
            sender: 'patient',
            text: 'Hello doctor, I have severe headache since morning. Need an appointment today.',
            timestamp: '02:46 PM',
          },
          {
            id: 'm2',
            sender: 'doctor',
            text: 'Hello Rahul! Please let me check the available timetable slots for today.',
            timestamp: '02:48 PM',
          },
          {
            id: 'm3',
            sender: 'patient',
            text: 'Could you please check if 10:30 AM or nearest available slot can be confirmed?',
            timestamp: '02:49 PM',
          },
        ],
      },
      {
        id: 'thread-divya',
        patientName: 'Divya Nair',
        phoneNumber: '+91 70349 95057',
        age: 26,
        gender: 'Female',
        priority: 'Urgent',
        status: 'pending',
        requestedSlot: '11:30 AM',
        requestedDate: '2026-10-23',
        symptoms: 'High fever 102°F and chills',
        lastMessage: 'High fever 102°F since last night. Is there an emergency slot available?',
        lastMessageTime: '12:15 PM',
        unread: true,
        messages: [
          {
            id: 'm20',
            sender: 'patient',
            text: 'Hi Doctor, I have high fever 102°F and body chills since last night. It feels urgent.',
            timestamp: '12:14 PM',
          },
          {
            id: 'm21',
            sender: 'patient',
            text: 'Can I get an immediate emergency triage slot or quota bypass?',
            timestamp: '12:15 PM',
          },
        ],
      },
      {
        id: 'thread-praveen',
        patientName: 'Praveen John',
        phoneNumber: '+91 77367 69946',
        age: 45,
        gender: 'Male',
        priority: 'Normal',
        status: 'link_sent',
        requestedSlot: '12:00 PM',
        requestedDate: '2026-10-23',
        symptoms: 'Routine BP checkup & prescription renewal',
        lastMessage: 'Looking for a slot around noon for regular BP checkup.',
        lastMessageTime: '12:12 PM',
        unread: false,
        messages: [
          {
            id: 'm30',
            sender: 'patient',
            text: 'Hello clinic, I need a routine follow-up for blood pressure prescription renewal.',
            timestamp: '12:10 PM',
          },
          {
            id: 'm31',
            sender: 'system',
            text: 'Automated WhatsApp Response: Booking link generated for self-service scheduling.',
            timestamp: '12:12 PM',
          },
        ],
      },
      {
        id: 'thread-advik',
        patientName: 'Advik Menon',
        phoneNumber: '+91 90000 00055',
        age: 8,
        gender: 'Male',
        priority: 'Normal',
        status: 'booked',
        requestedSlot: '09:30 AM',
        requestedDate: '2026-10-23',
        symptoms: 'Pediatric cough & sore throat',
        lastMessage: 'Slot confirmed. Token #P004.',
        lastMessageTime: '09:05 AM',
        unread: false,
        tokenNumber: 'P004',
        messages: [
          {
            id: 'm40',
            sender: 'patient',
            text: 'Need appointment for my child suffering from persistent cold.',
            timestamp: '08:50 AM',
          },
          {
            id: 'm41',
            sender: 'doctor',
            text: 'Appointment booked for 09:30 AM. Token #P004.',
            timestamp: '09:05 AM',
            isBookingReceipt: true,
            tokenNumber: 'P004',
            slotTime: '09:30 AM',
            date: '2026-10-23',
          },
        ],
      },
    ];

    if (dbRequests && dbRequests.length > 0) {
      // Group all Supabase requests by normalized phone number (last 10 digits)
      const phoneGroups = new Map<string, typeof dbRequests>();
      for (const req of dbRequests) {
        const phone = req.phone_number || '';
        const key = phone.replace(/[^0-9]/g, '').slice(-10) || phone;
        if (!phoneGroups.has(key)) {
          phoneGroups.set(key, []);
        }
        phoneGroups.get(key)!.push(req);
      }

      const dbMapped: PatientChatThread[] = [];

      phoneGroups.forEach((requests, key) => {
        // Sort chronologically (oldest first for message stream)
        const sorted = [...requests].sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tA - tB;
        });

        const latest = sorted[sorted.length - 1];

        // Determine best patient name
        let patientName = '';
        for (const r of sorted) {
          if (r.patient_name && r.patient_name.trim()) {
            patientName = r.patient_name.replace(/[_]/g, ' ').trim();
            break;
          }
        }
        if (!patientName) {
          patientName = `Patient (${key.slice(-4)})`;
        }

        const formattedLastTime = latest.created_at
          ? new Date(latest.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Today';

        const hasUrgent = sorted.some((r) => {
          const t = (r.message_text || '').toLowerCase();
          const n = (r.patient_name || '').toLowerCase();
          return n.includes('urgent') || t.includes('urgent') || t.includes('fever') || r.status === 'urgent';
        });

        const isBooked = sorted.some((r) => r.status === 'booked');

        // Build messages stream showing full chat and actions
        const messages: ChatMessage[] = [];

        sorted.forEach((req) => {
          const msgTime = req.created_at
            ? new Date(req.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : formattedLastTime;

          const rawPayload = req.raw_payload as any;
          const incomingMsg = rawPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
          const isFromDoctor = rawPayload?.sender === 'doctor';

          if (isFromDoctor) {
            messages.push({
              id: `msg-${req.id}`,
              sender: 'doctor',
              text: req.message_text || rawPayload?.text?.body || 'Doctor response sent.',
              timestamp: msgTime,
              messageType: 'text',
            });
          } else {
            // Patient inbound message
            let msgText = req.message_text || '';
            let isInteractive = false;
            let interactiveOption = '';

            if (incomingMsg?.type === 'interactive' || rawPayload?.interactive) {
              isInteractive = true;
              const interactiveObj = incomingMsg?.interactive || rawPayload?.interactive;
              interactiveOption =
                interactiveObj?.button_reply?.title ||
                interactiveObj?.list_reply?.title ||
                'Book a Slot';
              msgText = `Selected option: "${interactiveOption}"`;
            } else if (incomingMsg?.text?.body) {
              msgText = incomingMsg.text.body;
            } else if (!msgText) {
              msgText = req.status === 'link_sent'
                ? 'Requested self-service booking link via WhatsApp'
                : 'Inbound appointment inquiry via WhatsApp';
            }

            messages.push({
              id: `msg-${req.id}`,
              sender: 'patient',
              text: msgText,
              timestamp: msgTime,
              messageType: isInteractive ? 'interactive' : 'text',
              interactiveOption: isInteractive ? interactiveOption : undefined,
            });
          }

          // System Action in response to this message
          if (req.status === 'link_sent') {
            messages.push({
              id: `act-link-${req.id}`,
              sender: 'system',
              text: 'Autoresponder sent self-service appointment booking link on WhatsApp.',
              timestamp: msgTime,
              messageType: 'action',
              actionType: 'link_sent',
            });
          } else if (req.status === 'booked') {
            messages.push({
              id: `act-booked-${req.id}`,
              sender: 'doctor',
              text: 'Appointment confirmed and scheduled in the live queue.',
              timestamp: msgTime,
              isBookingReceipt: true,
              tokenNumber: 'P00' + (dbMapped.length + 1),
              date: req.preferred_date || 'Today',
              messageType: 'action',
              actionType: 'slot_booked',
            });
          }
        });

        const lastMsg = messages[messages.length - 1];

        dbMapped.push({
          id: latest.id,
          patientName,
          phoneNumber: latest.phone_number || `+91 ${key}`,
          age: 28,
          gender: 'Male',
          priority: hasUrgent ? 'Urgent' : 'Normal',
          status: isBooked ? 'booked' : (latest.status as any) || 'received',
          requestedSlot: '10:00 AM',
          requestedDate: latest.preferred_date || '2026-10-23',
          symptoms: lastMsg?.text || 'WhatsApp inquiry',
          lastMessage: lastMsg?.text || 'WhatsApp inquiry',
          lastMessageTime: formattedLastTime,
          unread: !isBooked,
          tokenNumber: isBooked ? 'P00' + (dbMapped.length + 1) : undefined,
          messages,
        });
      });

      // Merge with default mock threads if needed (deduplicating by phone)
      const seenPhones = new Set<string>();
      const combined: PatientChatThread[] = [];
      for (const t of [...dbMapped, ...defaultThreads]) {
        const key = t.phoneNumber.replace(/[^0-9]/g, '').slice(-10);
        if (!seenPhones.has(key)) {
          seenPhones.add(key);
          combined.push(t);
        }
      }
      return combined;
    }

    return defaultThreads;
  } catch (err) {
    console.warn('Error fetching inbound chat threads:', err);
    return [];
  }
}

export async function updateWhatsappRequestStatus(id: string, status: string) {
  try {
    await supabase.from('whatsapp_requests').update({ status }).eq('id', id);
  } catch (err) {
    console.warn('Error updating whatsapp request status:', err);
  }
}

export async function sendDoctorReplyToChat(
  phoneNumber: string,
  patientName: string,
  replyText: string,
  action?: 'reply' | 'link_sent' | 'urgent'
): Promise<ChatMessage | null> {
  try {
    const status = action === 'link_sent' ? 'link_sent' : 'replied';
    const { data, error } = await supabase
      .from('whatsapp_requests')
      .insert({
        phone_number: phoneNumber,
        patient_name: patientName,
        status: status,
        message_text: replyText,
        raw_payload: {
          sender: 'doctor',
          type: 'text',
          action: action || 'reply',
          text: { body: replyText },
        },
      })
      .select()
      .single();

    if (error) {
      console.warn('Error inserting doctor reply into whatsapp_requests:', error);
      return null;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      id: `doctor-${data.id}`,
      sender: 'doctor',
      text: replyText,
      timestamp,
      messageType: 'text',
    };
  } catch (err) {
    console.warn('sendDoctorReplyToChat error:', err);
    return null;
  }
}

export async function sendQuickBookingLink(
  phoneNumber: string,
  patientName: string
): Promise<ChatMessage | null> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://health-sync.app';
  const bookingLink = `${origin}/?phone=${encodeURIComponent(phoneNumber)}`;
  const replyText = `Hello ${patientName}! You can choose your appointment slot directly here: ${bookingLink}`;
  return sendDoctorReplyToChat(phoneNumber, patientName, replyText, 'link_sent');
}

export async function markThreadUrgentInDb(phoneNumber: string): Promise<boolean> {
  try {
    const key = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    const { error } = await supabase
      .from('whatsapp_requests')
      .update({ status: 'urgent' })
      .ilike('phone_number', `%${key}%`);
    return !error;
  } catch (err) {
    console.warn('markThreadUrgentInDb error:', err);
    return false;
  }
}



