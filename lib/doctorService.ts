import { supabase } from './supabaseClient';
import bcrypt from 'bcryptjs';
import { DbDoctor, DbClinicLocation } from '@/types/database';
import { getDoctorsLocal } from './supabaseService';

export interface DoctorWithBranches extends DbDoctor {
  assigned_branch_ids?: string[];
  assigned_branches?: { id: string; branch_name: string; branch_code?: string }[];
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
  pin_code?: string;
  is_admin_doctor: boolean;
  is_active: boolean;
  branch_ids: string[];
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
      const clinicName = branchData?.clinic_name || 'this clinic';
      return {
        success: false,
        message: `Access Denied: Dr. ${matchedDoctor.full_name} is affiliated with a different clinic organization and cannot access ${clinicName}.`,
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
      const { data: assignments } = await supabase
        .from('doctor_locations')
        .select('id, location_id')
        .eq('doctor_id', matchedDoctor.id)
        .eq('location_id', branchId)
        .eq('is_active', true);

      if (assignments && assignments.length > 0) {
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

      const { data: anyAssignments } = await supabase
        .from('doctor_locations')
        .select('id')
        .eq('doctor_id', matchedDoctor.id)
        .eq('is_active', true);

      if (!anyAssignments || anyAssignments.length === 0) {
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

      const branchName = branchData?.branch_name || branchId;
      return {
        success: false,
        message: `Access Denied: Dr. ${matchedDoctor.full_name} is not assigned to ${branchName}.`,
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
 */
export async function getDoctorsByClinic(clinicId: string): Promise<DoctorWithBranches[]> {
  try {
    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('clinic_id', clinicId)
      .neq('is_deleted', true)
      .order('full_name', { ascending: true });

    if (error || !doctors) {
      console.warn('getDoctorsByClinic error:', error?.message);
      return [];
    }

    // Fetch assignments for all doctors in this clinic
    const docIds = doctors.map((d: any) => d.id);
    const { data: dlData } = await supabase
      .from('doctor_locations')
      .select('doctor_id, location_id')
      .in('doctor_id', docIds)
      .eq('is_active', true);

    const { data: locs } = await supabase
      .from('clinic_locations')
      .select('id, branch_name, branch_code')
      .eq('clinic_id', clinicId);

    const locMap = new Map((locs || []).map((l: any) => [l.id, l]));

    const enriched: DoctorWithBranches[] = doctors.map((doc: any) => {
      const myAssignments = (dlData || []).filter((dl: any) => dl.doctor_id === doc.id);
      const branchIds = myAssignments.map((a: any) => a.location_id);
      const branches = branchIds
        .map((bid: string) => locMap.get(bid))
        .filter(Boolean) as { id: string; branch_name: string; branch_code?: string }[];

      return {
        ...doc,
        assigned_branch_ids: branchIds,
        assigned_branches: branches,
      };
    });

    return enriched;
  } catch (err) {
    console.warn('getDoctorsByClinic exception:', err);
    return [];
  }
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

    // 2. Get assigned doctors from doctor_locations
    const { data: dl } = await supabase
      .from('doctor_locations')
      .select('doctor_id')
      .eq('location_id', branchId)
      .eq('is_active', true);

    const assignedDocIds = new Set((dl || []).map((d: any) => d.doctor_id));

    // 3. Fetch all active doctors for this clinic
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

    // Filter to doctors assigned to this branch OR who are Admin Doctors of this clinic
    const eligible = allDocs.filter((d: any) => {
      if (d.is_admin_doctor) return true; // Admin doctor has access to all branches
      return assignedDocIds.has(d.id);
    });

    return eligible as DbDoctor[];
  } catch (err) {
    console.warn('getDoctorsByBranch exception:', err);
    return [];
  }
}

/**
 * 5. Admin Upsert Doctor with Multi-Branch Assignments
 */
export async function adminUpsertDoctorWithBranches(payload: AdminUpsertDoctorPayload): Promise<{
  success: boolean;
  doctor_id?: string;
  message?: string;
}> {
  try {
    const docData: Record<string, any> = {
      clinic_id: payload.clinic_id,
      full_name: payload.full_name.trim(),
      specialization: payload.specialization.trim(),
      reg_no: payload.reg_no.trim(),
      phone: payload.phone?.trim() || null,
      daily_quota: payload.daily_quota || 30,
      is_admin_doctor: payload.is_admin_doctor || false,
      is_active: payload.is_active !== undefined ? payload.is_active : true,
      is_deleted: false,
    };

    if (payload.pin_code && payload.pin_code.trim()) {
      docData.pin_code = payload.pin_code.trim();
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

    // Sync doctor_locations
    // 1. Delete existing assignments
    await supabase.from('doctor_locations').delete().eq('doctor_id', doctorId);

    // 2. Insert new branch assignments (if regular doctor, or if admin has specific branches selected)
    const branchesToInsert = payload.branch_ids || [];
    if (branchesToInsert.length > 0) {
      const rows = branchesToInsert.map((bid) => ({
        doctor_id: doctorId,
        location_id: bid,
        is_active: true,
      }));
      const { error: dlErr } = await supabase.from('doctor_locations').insert(rows);
      if (dlErr) console.warn('Error inserting doctor_locations:', dlErr.message);
    }

    return {
      success: true,
      doctor_id: doctorId,
      message: `Doctor ${payload.full_name} saved successfully`,
    };
  } catch (err: any) {
    console.error('adminUpsertDoctorWithBranches exception:', err);
    return { success: false, message: err?.message || 'Failed to save doctor' };
  }
}

/**
 * 6. Soft Delete / Deactivate Doctor
 */
export async function adminDeleteDoctor(doctorId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await supabase
      .from('doctors')
      .update({ is_deleted: true, is_active: false })
      .eq('id', doctorId);

    if (error) throw error;
    // Also remove from doctor_locations
    await supabase.from('doctor_locations').delete().eq('doctor_id', doctorId);

    return { success: true, message: 'Doctor deactivated successfully' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to delete doctor' };
  }
}

