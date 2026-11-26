import { supabase } from './supabaseClient';
import bcrypt from 'bcryptjs';
import { DbDoctor, DbClinicLocation } from '@/types/database';
import { getDoctorsLocal, clearDoctorsCacheLocal } from './supabaseService';

export interface DoctorWithBranches extends DbDoctor {
  assigned_branch_ids?: string[];
  assigned_branches?: { id: string; branch_name: string; branch_code?: string }[];
  chamber_pin?: string;
  is_all_branches?: boolean;
  today_patient_count?: number;
}

export function getStoredAdminPin(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('healthsync_admin_pin') ||
    localStorage.getItem('healthsync_chamber_pin') ||
    ''
  );
}

export function setStoredAdminPin(pin: string): void {
  if (typeof window === 'undefined') return;
  if (pin && pin.trim()) {
    localStorage.setItem('healthsync_admin_pin', pin.trim());
  }
}

export interface VerifyBranchGatewayResult {
  success: boolean;
  clinic_id?: string;
  clinic_name?: string;
  branch_id?: string;
  branch_name?: string;
  branch_code?: string;
  message?: string;
}

export interface VerifyBranchDoctorResult {
  success: boolean;
  doctor_id?: string;
  doctor_name?: string;
  specialization?: string;
  is_admin_doctor?: boolean;
  authorized_branch_id?: string;
  message?: string;
  doctor?: DbDoctor;
}

export interface AdminUpsertDoctorPayload {
  id?: string;
  clinic_id: string;
  full_name: string;
  specialization: string;
  reg_no: string;
  phone?: string;
  daily_quota: number;
  consultation_fee?: number;
  pin_code?: string;
  is_admin_doctor: boolean;
  is_active: boolean;
  location_id?: string | null;
  branch_ids?: string[];
}

export interface ValidateAccessPinResult {
  success: boolean;
  clinic_id?: string;
  location_id?: string | null;
  doctor_id?: string | null;
  label?: string;
  clinic_name?: string;
  branch_name?: string | null;
  doctor_name?: string | null;
  is_admin_doctor?: boolean;
  has_branch?: boolean;
  has_doctor?: boolean;
  error?: string;
}

let validateAccessPinRpcAvailable: boolean | null = null;

/**
 * Direct validation using the unified access_pins table
 */
export async function validateAccessPin(pin: string): Promise<ValidateAccessPinResult> {
  const cleanPin = pin ? pin.trim() : '';
  if (!cleanPin) return { success: false, error: 'Please enter a PIN' };

  try {
    let data: any = null;
    // 1. Try PostgreSQL RPC unless already known to be absent in schema cache (PGRST202)
    if (validateAccessPinRpcAvailable !== false) {
      const rpcRes = await supabase.rpc('validate_access_pin', {
        p_pin: cleanPin,
      });
      data = rpcRes.data;

      if (rpcRes.error?.code === 'PGRST202') {
        validateAccessPinRpcAvailable = false;
      } else if (!rpcRes.error) {
        validateAccessPinRpcAvailable = true;
      }

      if (!rpcRes.error && data && data.success === true) {
        return data as ValidateAccessPinResult;
      }
    }

    // 2. Direct fallback to access_pins table (works immediately even if RPC is not created yet)
    const { data: ap, error: apErr } = await supabase
      .from('access_pins')
      .select('pin, clinic_id, location_id, doctor_id, label, is_active')
      .eq('pin', cleanPin)
      .eq('is_active', true)
      .maybeSingle();

    if (ap && !apErr) {
      let clinicName = 'Clinic';
      if (ap.clinic_id) {
        const { data: c } = await supabase.from('clinics').select('name').eq('id', ap.clinic_id).maybeSingle();
        if (c?.name) clinicName = c.name;
      }
      let branchName: string | null = null;
      if (ap.location_id) {
        const { data: b } = await supabase.from('clinic_locations').select('branch_name').eq('id', ap.location_id).maybeSingle();
        if (b?.branch_name) branchName = b.branch_name;
      }
      let doctorName: string | null = null;
      let isAdminDoctor = false;
      if (ap.doctor_id) {
        const { data: d } = await supabase
          .from('doctors')
          .select('full_name, is_admin_doctor')
          .eq('id', ap.doctor_id)
          .maybeSingle();
        if (d?.full_name) doctorName = d.full_name;
        if (d?.is_admin_doctor) isAdminDoctor = true;
      }

      return {
        success: true,
        clinic_id: ap.clinic_id,
        location_id: ap.location_id,
        doctor_id: ap.doctor_id,
        label: ap.label,
        clinic_name: clinicName,
        branch_name: branchName,
        doctor_name: doctorName,
        is_admin_doctor: isAdminDoctor,
        has_branch: Boolean(ap.location_id),
        has_doctor: Boolean(ap.doctor_id),
      };
    }

    return {
      success: false,
      error: data?.error || 'Invalid PIN. Please try again.',
    };
  } catch (err: any) {
    console.warn('validateAccessPin exception:', err);
    return { success: false, error: err?.message || 'Verification failed' };
  }
}

// In-memory failed attempts tracker for chamber lockout
const chamberFailedAttempts = new Map<string, { count: number; lockedUntil: number }>();

/**
 * 1. Direct Branch Gateway Login via unique Branch PIN
 */
export async function verifyBranchGatewayLogin(branchPin: string): Promise<VerifyBranchGatewayResult> {
  const cleanPin = branchPin ? branchPin.trim() : '';
  if (!cleanPin) return { success: false, message: 'Branch PIN is required' };

  try {
    // 1. Try PostgreSQL RPC
    const { data: rpcData, error: rpcErr } = await supabase.rpc('verify_branch_gateway_login', {
      p_branch_pin: cleanPin,
    });

    if (!rpcErr && rpcData && rpcData.success === true) {
      return {
        success: true,
        branch_id: rpcData.branch_id || rpcData.id,
        branch_name: rpcData.branch_name,
        branch_code: rpcData.branch_code,
        clinic_id: rpcData.clinic_id,
        clinic_name: rpcData.clinic_name,
        message: `Authenticated: ${rpcData.branch_name}`,
      };
    }

    // 2. Direct fallback table query
    const { data: locs } = await supabase
      .from('clinic_locations')
      .select('id, branch_name, branch_code, clinic_id, clinic_name, gateway_pin')
      .eq('is_active', true);

    const matched = locs?.find((l: any) => l.gateway_pin === cleanPin);
    if (matched) {
      return {
        success: true,
        branch_id: matched.id,
        branch_name: matched.branch_name,
        branch_code: matched.branch_code || undefined,
        clinic_id: matched.clinic_id || undefined,
        clinic_name: matched.clinic_name || undefined,
        message: `Authenticated: ${matched.branch_name}`,
      };
    }
  } catch (err) {
    console.warn('verifyBranchGatewayLogin error:', err);
  }

  return { success: false, message: 'Invalid Branch Gateway PIN' };
}

/**
 * 2. Branch-Based Doctor Chamber Authentication with Strict Tenant & Assignment Rules
 */
export async function verifyBranchDoctorPin(
  pin: string,
  branchId: string,
  clinicId?: string
): Promise<VerifyBranchDoctorResult> {
  const cleanPin = pin ? pin.trim() : '';
  if (!cleanPin) return { success: false, message: 'Doctor PIN is required' };
  if (!branchId && !clinicId) return { success: false, message: 'Active clinic context is required' };

  const lockoutKey = `lockout_${branchId || clinicId || 'clinic'}_${cleanPin.slice(0, 2)}`;
  const lockInfo = chamberFailedAttempts.get(lockoutKey);
  if (lockInfo && lockInfo.lockedUntil > Date.now()) {
    const remainSec = Math.ceil((lockInfo.lockedUntil - Date.now()) / 1000);
    return {
      success: false,
      message: `Chamber locked due to 3 failed attempts. Please retry in ${remainSec}s.`,
    };
  }

  try {
    let branchData: any = null;
    if (branchId) {
      const { data } = await supabase
        .from('clinic_locations')
        .select('id, branch_name, branch_code, clinic_id, clinic_name')
        .eq('id', branchId)
        .maybeSingle();
      branchData = data;
    }

    const targetClinicId = clinicId || branchData?.clinic_id;

    let { data: doctors, error: docErr } = await supabase
      .from('doctors')
      .select('*')
      .eq('is_active', true);

    if (docErr || !doctors || doctors.length === 0) {
      const local = getDoctorsLocal();
      if (local && local.length > 0) {
        doctors = local;
      } else {
        return { success: false, message: 'No active doctors found' };
      }
    }

    let matchedDoctor: DbDoctor | null = null;
    for (const doc of doctors) {
      if (doc.pin_code) {
        if (cleanPin === doc.pin_code) {
          matchedDoctor = doc;
          break;
        }
        try {
          if (doc.pin_code.startsWith('$2') && bcrypt.compareSync(cleanPin, doc.pin_code)) {
            matchedDoctor = doc;
            break;
          }
        } catch {}
      }
    }

    if (!matchedDoctor) {
      const cur = chamberFailedAttempts.get(lockoutKey) || { count: 0, lockedUntil: 0 };
      cur.count += 1;
      if (cur.count >= 3) {
        cur.lockedUntil = Date.now() + 30 * 1000;
        cur.count = 0;
      }
      chamberFailedAttempts.set(lockoutKey, cur);
      return { success: false, message: 'Invalid Doctor Security PIN' };
    }

    chamberFailedAttempts.delete(lockoutKey);

    if (targetClinicId && matchedDoctor.clinic_id && matchedDoctor.clinic_id !== targetClinicId) {
      return {
        success: false,
        message: 'Invalid PIN. Please check and try again.',
      };
    }

    if (matchedDoctor.is_admin_doctor) {
      return {
        success: true,
        doctor_id: matchedDoctor.id,
        doctor_name: matchedDoctor.full_name,
        specialization: matchedDoctor.specialization || 'General Medicine',
        is_admin_doctor: true,
        authorized_branch_id: branchId || undefined,
        message: `Admin Doctor Authenticated: Dr. ${matchedDoctor.full_name}`,
        doctor: matchedDoctor,
      };
    }

    if (branchId) {
      // Direct location_id check: NULL means floating/all-branches, otherwise must match branchId
      if (!matchedDoctor.location_id || matchedDoctor.location_id === branchId) {
        return {
          success: true,
          doctor_id: matchedDoctor.id,
          doctor_name: matchedDoctor.full_name,
          specialization: matchedDoctor.specialization || 'General Medicine',
          is_admin_doctor: false,
          authorized_branch_id: branchId,
          message: `Chamber Unlocked: Dr. ${matchedDoctor.full_name}`,
          doctor: matchedDoctor,
        };
      }

      return {
        success: false,
        message: 'Invalid PIN for this branch. Please check and try again.',
      };
    }

    return {
      success: true,
      doctor_id: matchedDoctor.id,
      doctor_name: matchedDoctor.full_name,
      specialization: matchedDoctor.specialization || 'General Medicine',
      is_admin_doctor: false,
      message: `Chamber Unlocked: Dr. ${matchedDoctor.full_name}`,
      doctor: matchedDoctor,
    };
  } catch (err: any) {
    console.warn('verifyBranchDoctorPin exception:', err);
    return { success: false, message: err?.message || 'Error authenticating doctor' };
  }
}

/**
 * 3. Fetch Doctors for a Specific Clinic (Admin View)
 * Calls PostgreSQL RPC `get_clinic_doctors_admin` (single LEFT JOIN on clinic_locations)
 */
export async function getDoctorsByClinic(
  clinicId: string,
  adminPin?: string
): Promise<DoctorWithBranches[]> {
  // 1. Primary: Call new Direct Location RPC get_clinic_doctors_admin
  if (clinicId) {
    try {
      const { data, error } = await supabase.rpc('get_clinic_doctors_admin', {
        p_clinic_id: clinicId,
      });

      if (!error && Array.isArray(data)) {
        return data.map((d: any) => {
          const isAll = Boolean(!d.location_id || d.is_admin_doctor || d.branch_code === 'ALL');
          const branchName = d.branch_name || (isAll ? 'All Branches' : 'Assigned Branch');
          const branchCode = d.branch_code || (isAll ? 'ALL' : '');
          return {
            ...d,
            location_id: d.location_id || null,
            branch_name: branchName,
            branch_code: branchCode,
            chamber_pin: d.pin_code || '',
            is_all_branches: isAll,
            assigned_branch_ids: d.location_id ? [d.location_id] : [],
            assigned_branches: d.location_id
              ? [{ id: d.location_id, branch_name: branchName, branch_code: branchCode }]
              : [],
            today_patient_count: 0,
          };
        });
      }
    } catch (rpcErr) {
      console.warn('get_clinic_doctors_admin direct RPC note:', rpcErr);
    }
  }

  // 2. Direct single table query fallback (JOIN clinic_locations directly!)
  try {
    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('*, clinic_locations(id, branch_name, branch_code)')
      .eq('clinic_id', clinicId)
      .neq('is_deleted', true)
      .order('is_admin_doctor', { ascending: false })
      .order('full_name', { ascending: true });

    if (!error && doctors) {
      return doctors.map((doc: any) => {
        const loc = doc.clinic_locations;
        const isAll = Boolean(!doc.location_id || doc.is_admin_doctor);
        const branchName = loc?.branch_name || (isAll ? 'All Branches' : 'Assigned Branch');
        const branchCode = loc?.branch_code || (isAll ? 'ALL' : '');
        return {
          ...doc,
          location_id: doc.location_id || null,
          branch_name: branchName,
          branch_code: branchCode,
          chamber_pin: doc.pin_code || '',
          is_all_branches: isAll,
          assigned_branch_ids: doc.location_id ? [doc.location_id] : [],
          assigned_branches: doc.location_id
            ? [{ id: doc.location_id, branch_name: branchName, branch_code: branchCode }]
            : [],
        };
      });
    }
  } catch (err) {
    console.warn('getDoctorsByClinic fallback exception:', err);
  }
  return [];
}

/**
 * 4. Fetch Doctors Assigned to a Specific Branch (Queue / Chamber View)
 */
export async function getDoctorsByBranch(branchId: string): Promise<DbDoctor[]> {
  try {
    // 1. Get branch info to know clinic
    const { data: branch } = await supabase
      .from('clinic_locations')
      .select('id, clinic_id')
      .eq('id', branchId)
      .maybeSingle();

    const clinicId = branch?.clinic_id;

    // 2. Fetch all active doctors for this clinic directly using doctors.location_id
    let query = supabase
      .from('doctors')
      .select('*')
      .eq('is_active', true)
      .neq('is_deleted', true);

    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    const { data: allDocs } = await query;
    if (!allDocs) return [];

    // Filter to doctors assigned to this branch OR floating (location_id is null) OR Admin Doctors
    const eligible = allDocs.filter((d: any) => {
      if (d.is_admin_doctor || !d.location_id) return true;
      return d.location_id === branchId;
    });

    return eligible as DbDoctor[];
  } catch (err) {
    console.warn('getDoctorsByBranch exception:', err);
    return [];
  }
}

/**
 * 5. Admin Upsert Doctor with Multi-Branch Assignments
 * Calls PostgreSQL RPC `admin_create_doctor` or `admin_update_doctor` with table fallback
 */
export async function adminUpsertDoctorWithBranches(
  payload: AdminUpsertDoctorPayload,
  adminPin?: string
): Promise<{
  success: boolean;
  doctor_id?: string;
  message?: string;
}> {
  const pin = (adminPin || getStoredAdminPin()).trim();
  const assignedLocationId = payload.is_admin_doctor
    ? null
    : (payload.location_id || (payload.branch_ids && payload.branch_ids.length > 0 ? payload.branch_ids[0] : null));

  // 1. Primary: Try Direct Location RPCs
  if (payload.clinic_id) {
    try {
      if (payload.id) {
        // UPDATE DOCTOR RPC (p_doctor_id, p_full_name, ...)
        const { data, error } = await supabase.rpc('admin_update_doctor', {
          p_doctor_id: payload.id,
          p_full_name: payload.full_name.trim(),
          p_specialization: payload.specialization.trim(),
          p_reg_no: payload.reg_no.trim(),
          p_consultation_fee: payload.consultation_fee || 500,
          p_daily_quota: Number(payload.daily_quota) || 30,
          p_pin_code: payload.pin_code?.trim() || null,
          p_is_admin_doctor: payload.is_admin_doctor,
          p_is_active: payload.is_active !== undefined ? payload.is_active : true,
          p_location_id: assignedLocationId,
        });

        if (!error && data) {
          if (data.success === false) {
            return {
              success: false,
              message: data.error || data.error_message || data.message || 'Failed to update doctor profile',
            };
          }
          clearDoctorsCacheLocal();
          return {
            success: true,
            doctor_id: payload.id,
            message: data.message || `Doctor ${payload.full_name} updated successfully`,
          };
        }
      } else {
        // CREATE DOCTOR RPC (p_clinic_id, p_full_name, ...)
        const { data, error } = await supabase.rpc('admin_create_doctor', {
          p_clinic_id: payload.clinic_id,
          p_full_name: payload.full_name.trim(),
          p_specialization: payload.specialization.trim(),
          p_reg_no: payload.reg_no.trim(),
          p_consultation_fee: payload.consultation_fee || 500,
          p_daily_quota: Number(payload.daily_quota) || 30,
          p_pin_code: payload.pin_code?.trim() || '1234',
          p_is_admin_doctor: payload.is_admin_doctor,
          p_location_id: assignedLocationId,
        });

        if (!error && data) {
          if (data.success === false) {
            return {
              success: false,
              message: data.error || data.error_message || data.message || 'Failed to add doctor',
            };
          }
          clearDoctorsCacheLocal();
          return {
            success: true,
            doctor_id: data.doctor_id,
            message: data.message || `Doctor ${payload.full_name} added successfully`,
          };
        }
      }
    } catch (rpcErr: any) {
      console.warn('admin_create_doctor / admin_update_doctor RPC note:', rpcErr);
    }
  }

  // 2. Direct fallback to Supabase tables (saving location_id directly in doctors)
  try {
    const docData: Record<string, any> = {
      clinic_id: payload.clinic_id,
      full_name: payload.full_name.trim(),
      specialization: payload.specialization.trim(),
      reg_no: payload.reg_no.trim(),
      phone: payload.phone?.trim() || null,
      daily_quota: payload.daily_quota || 30,
      consultation_fee: payload.consultation_fee || 500,
      is_admin_doctor: payload.is_admin_doctor || false,
      is_active: payload.is_active !== undefined ? payload.is_active : true,
      is_deleted: false,
      location_id: assignedLocationId,
      updated_at: new Date().toISOString(),
    };

    const cleanChamberPin = payload.pin_code?.trim();
    if (cleanChamberPin) {
      docData.pin_code = cleanChamberPin;
    }

    let doctorId = payload.id;

    if (doctorId) {
      // Update doctor
      const { error: updateErr } = await supabase
        .from('doctors')
        .update(docData)
        .eq('id', doctorId);

      if (updateErr) throw updateErr;
    } else {
      // Insert new doctor
      const { data: inserted, error: insertErr } = await supabase
        .from('doctors')
        .insert([docData])
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      doctorId = inserted.id;
    }

    if (!doctorId) {
      return { success: false, message: 'Failed to resolve doctor record' };
    }

    // Sync access_pins for chamber PIN entry
    if (cleanChamberPin) {
      try {
        await supabase.from('access_pins').delete().eq('doctor_id', doctorId);
        await supabase.from('access_pins').insert([
          {
            pin: cleanChamberPin,
            clinic_id: payload.clinic_id,
            location_id: assignedLocationId,
            doctor_id: doctorId,
            label: `${payload.full_name.trim()} Chamber`,
            is_active: true,
          },
        ]);
      } catch (pinSyncErr) {
        console.warn('access_pins sync note:', pinSyncErr);
      }
    }

    clearDoctorsCacheLocal();
    return {
      success: true,
      doctor_id: doctorId,
      message: `Doctor ${payload.full_name} saved successfully with direct location`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to save doctor record' };
  }
}

/**
 * 6. Admin Delete / Deactivate Doctor
 * Calls PostgreSQL RPC `admin_delete_doctor` with table fallback
 */
export async function adminDeleteDoctor(
  doctorId: string,
  clinicId?: string,
  adminPin?: string
): Promise<{ success: boolean; message?: string }> {
  // 0. Safety Guard: Admin Doctors cannot be deleted
  const { data: targetDoc } = await supabase
    .from('doctors')
    .select('is_admin_doctor, full_name')
    .eq('id', doctorId)
    .maybeSingle();

  if (targetDoc?.is_admin_doctor) {
    return {
      success: false,
      message: 'Admin doctors cannot be removed or deleted from the clinic roster.',
    };
  }

  const pin = (adminPin || getStoredAdminPin()).trim();

  // 1. Primary: Call Supabase RPC admin_delete_doctor
  if (clinicId) {
    try {
      let { data, error } = await supabase.rpc('admin_delete_doctor', {
        p_clinic_id: clinicId,
        p_doctor_id: doctorId,
      });

      if (error?.code === 'PGRST202' && pin) {
        const retry = await supabase.rpc('admin_delete_doctor', {
          p_admin_pin: pin,
          p_clinic_id: clinicId,
          p_doctor_id: doctorId,
        });
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        if (data.success === false) {
          return {
            success: false,
            message: data.error || data.error_message || data.message || 'Cannot delete doctor',
          };
        }
        clearDoctorsCacheLocal();
        return {
          success: true,
          message: data.message || 'Doctor removed from clinic active directory successfully',
        };
      }
    } catch (rpcErr: any) {
      console.warn('admin_delete_doctor RPC note:', rpcErr);
    }
  }

  // 2. Direct fallback
  try {
    // Check if doctor has active waiting or in progress appointments today
    const todayYmd = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .gte('scheduled_time', `${todayYmd}T00:00:00`)
      .in('status', ['Waiting', 'In Progress']);

    if (count && count > 0) {
      return {
        success: false,
        message: `Cannot delete this doctor. There are ${count} patients currently waiting in their chamber queue today. Please reallocate or complete visits first.`,
      };
    }

    const { error } = await supabase
      .from('doctors')
      .update({ is_deleted: true, is_active: false, updated_at: new Date().toISOString() })
      .eq('id', doctorId);

    if (error) throw error;

    // Deactivate in access_pins
    await supabase.from('access_pins').update({ is_active: false }).eq('doctor_id', doctorId);

    clearDoctorsCacheLocal();
    return { success: true, message: 'Doctor removed from clinic active directory successfully' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to delete doctor' };
  }
}

