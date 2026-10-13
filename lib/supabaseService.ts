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

    // Find the doctor whose pin_code matches the entered PIN
    let matchedDoctor: DbDoctor | null = null;
    for (const doc of doctors) {
      if (doc.pin_code && bcrypt.compareSync(cleanPin, doc.pin_code)) {
        matchedDoctor = doc;
        break;
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

const DOCTOR_SESSION_KEY = 'healthsync_active_doctor_session';

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
          created_at
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

      return {
        id: item.id,
        patientDbId: item.patient_id,
        name: patient?.full_name || 'Walk-in Patient',
        age: patient?.age || 30,
        gender: (patient?.gender?.toLowerCase() === 'female' ? 'Female' : 'Male') as 'Male' | 'Female' | 'Other',
        phone: patient?.phone_number || undefined,
        status: (item.status as 'Waiting' | 'In Progress' | 'Completed') || 'Waiting',
        time: timeStr,
        tokenNumber: index + 1,
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
      .select('id, full_name, age, gender, phone_number')
      .eq('phone_number', patientPhone)
      .maybeSingle();

    if (existingPatient) {
      patientId = existingPatient.id;
      patientName = existingPatient.full_name || params.name;
      patientAge = existingPatient.age || params.age;
      patientGender = existingPatient.gender || params.gender;
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
        .select()
        .single();

      if (patientError || !patientData) {
        console.error('Error creating patient:', patientError);
        return null;
      }
      patientId = patientData.id;
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
      tokenNumber: 1,
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
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
