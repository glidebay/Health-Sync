'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  X,
  MapPin,
  Users,
  AlertCircle,
} from 'lucide-react';
import {
  DoctorWithBranches,
  getDoctorsByClinic,
  adminUpsertDoctorWithBranches,
  adminDeleteDoctor,
  getStoredAdminPin,
} from '@/lib/doctorService';
import { fetchClinicLocations, clearDoctorsCacheLocal } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import { DbClinicLocation } from '@/types/database';
import { EcgActionLoader } from '@/components/loading/EcgActionLoader';

export const CLINIC_OPTIONS = [
  {
    id: '02acab28-14bf-44cf-9a89-ad13dc7a7e80',
    name: 'Aster Prime Clinic',
    badge: 'Central Organization',
  },
  {
    id: '2478eaca-ea74-44f7-b4b2-d6c5924a33b5',
    name: 'Apollo Health Clinic',
    badge: 'Partner Network',
  },
  {
    id: '9e8b98f5-e268-4b11-8ca1-ec1ce83292ea',
    name: 'HealthSync Medical Center',
    badge: 'Central Organization',
  },
  {
    id: '94371a54-680b-463e-90df-87e469838891',
    name: 'Dreams Pharma & Clinic (HQ)',
    badge: 'Partner Network',
  },
];

const SPECIALIZATION_OPTIONS = [
  'General Medicine',
  'Cardiology & Vascular Medicine',
  'Consultant Gynecologist',
  'General Physician & Diabetologist',
  'Consultant Pediatrician',
  'Consultant ENT Specialist',
  'Consultant Orthopedic Surgeon',
  'Consultant Dermatologist',
  'Emergency Care & Casualty',
];

interface DoctorManagementSettingsProps {
  currentClinicId?: string | null;
  adminPin?: string;
  isAdminUser?: boolean;
  lockedLocationId?: string | null;
  lockedBranchName?: string | null;
}

/** Formats a doctor's name cleanly without duplicate "Dr. Dr." */
export function formatDoctorDisplayName(fullName: string): string {
  if (!fullName) return '';
  const stripped = fullName
    .replace(/^(?:dr\.?|doctor)\s+/gi, '')
    .replace(/^(?:dr\.?|doctor)\s+/gi, '')
    .trim();
  return `Dr. ${stripped}`;
}

export function DoctorManagementSettings({
  currentClinicId,
  adminPin,
  isAdminUser = true,
  lockedLocationId,
  lockedBranchName,
}: DoctorManagementSettingsProps) {
  const [clinicList, setClinicList] = useState<{ id: string; name: string; slug?: string }[]>([]);

  const effectiveAdminPin = useMemo(() => {
    return (adminPin || getStoredAdminPin() || '').trim();
  }, [adminPin]);

  useEffect(() => {
    async function loadClinics() {
      try {
        const { data } = await supabase.from('clinics').select('id, name, slug');
        if (data && data.length > 0) {
          setClinicList(data);
        }
      } catch (e) {
        console.warn('Failed to fetch clinics:', e);
      }
    }
    loadClinics();
  }, []);

  const effectiveClinicId = useMemo(() => {
    if (currentClinicId) return currentClinicId;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('healthsync_active_clinic_id');
      if (stored) return stored;
    }
    return clinicList[0]?.id || CLINIC_OPTIONS[0].id;
  }, [currentClinicId, clinicList]);

  const [selectedClinicId, setSelectedClinicId] = useState<string>(effectiveClinicId);

  useEffect(() => {
    if (effectiveClinicId) {
      setSelectedClinicId(effectiveClinicId);
    }
  }, [effectiveClinicId]);

  const activeClinicMeta = useMemo(() => {
    const fromDb = clinicList.find((c) => c.id === selectedClinicId);
    if (fromDb) {
      return { id: fromDb.id, name: fromDb.name, badge: 'Active Clinic' };
    }
    return (
      CLINIC_OPTIONS.find((c) => c.id === selectedClinicId) || {
        id: selectedClinicId,
        name: 'Clinic Organization',
        badge: 'HQ',
      }
    );
  }, [selectedClinicId, clinicList]);

  const [doctors, setDoctors] = useState<DoctorWithBranches[]>([]);
  const [branches, setBranches] = useState<DbClinicLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorWithBranches | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formSpec, setFormSpec] = useState(SPECIALIZATION_OPTIONS[0]);
  const [formCustomSpec, setFormCustomSpec] = useState('');
  const [formRegNo, setFormRegNo] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formQuota, setFormQuota] = useState(30);
  const [formPin, setFormPin] = useState('');
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [formLocationId, setFormLocationId] = useState<string>('');
  const [formError, setFormError] = useState('');

  // Load doctors and branches for selected clinic ONLY
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    const startTime = Date.now();
    try {
      const [docList, branchList] = await Promise.all([
        getDoctorsByClinic(selectedClinicId, effectiveAdminPin),
        fetchClinicLocations(selectedClinicId),
      ]);
      setDoctors(docList);
      setBranches(branchList);
      const elapsed = Date.now() - startTime;
      if (elapsed < 450) {
        await new Promise((r) => setTimeout(r, 450 - elapsed));
      }
    } catch (err: any) {
      console.warn('Failed to load clinic doctor roster:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClinicId, effectiveAdminPin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleDoctors = useMemo(() => {
    if (!isAdminUser && lockedLocationId) {
      return doctors.filter(
        (d) => d.location_id === lockedLocationId || !d.location_id || d.is_admin_doctor
      );
    }
    return doctors;
  }, [doctors, isAdminUser, lockedLocationId]);

  const handleOpenAdd = () => {
    setEditingDoctor(null);
    setFormName('');
    setFormSpec(SPECIALIZATION_OPTIONS[0]);
    setFormCustomSpec('');
    setFormRegNo(`KMC-${Math.floor(10000 + Math.random() * 90000)}`);
    setFormPhone('+91 ');
    setFormQuota(30);
    setFormPin('1234');
    setFormIsAdmin(false);
    setFormLocationId(!isAdminUser && lockedLocationId ? lockedLocationId : '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (doc: DoctorWithBranches) => {
    setEditingDoctor(doc);
    setFormName(doc.full_name || '');
    if (SPECIALIZATION_OPTIONS.includes(doc.specialization || '')) {
      setFormSpec(doc.specialization || SPECIALIZATION_OPTIONS[0]);
      setFormCustomSpec('');
    } else {
      setFormSpec('Other');
      setFormCustomSpec(doc.specialization || '');
    }
    setFormRegNo(doc.reg_no || '');
    setFormPhone((doc as any).phone || '+91 ');
    setFormQuota(doc.daily_quota || 30);
    setFormPin(''); // blank means keep existing PIN
    setFormIsAdmin(Boolean(doc.is_admin_doctor));
    setFormLocationId(doc.location_id || (doc.assigned_branch_ids && doc.assigned_branch_ids[0]) || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formatDoctorDisplayName(formName.trim());
    if (!cleanName.replace(/^dr\.?\s*/i, '').trim()) {
      setFormError('Doctor full name is required');
      return;
    }

    const specialization =
      formSpec === 'Other' ? formCustomSpec.trim() || 'General Medicine' : formSpec;

    if (!editingDoctor && !formPin.trim()) {
      setFormError('A 4-digit chamber security PIN is required for new doctors');
      return;
    }

    setIsSaving(true);
    try {
      const res = await adminUpsertDoctorWithBranches({
        id: editingDoctor ? editingDoctor.id : undefined,
        clinic_id: selectedClinicId,
        full_name: cleanName,
        specialization,
        reg_no: formRegNo.trim() || 'KMC-PENDING',
        phone: formPhone.trim() || undefined,
        daily_quota: Number(formQuota) || 30,
        pin_code: formPin.trim() || undefined,
        is_admin_doctor: isAdminUser ? formIsAdmin : false,
        is_active: true,
        location_id: !isAdminUser && lockedLocationId
          ? lockedLocationId
          : (formIsAdmin ? null : (formLocationId || null)),
        branch_ids: !isAdminUser && lockedLocationId
          ? [lockedLocationId]
          : (formIsAdmin ? [] : (formLocationId ? [formLocationId] : [])),
      }, effectiveAdminPin);

      if (res.success) {
        clearDoctorsCacheLocal();
        setStatusMessage({
          type: 'success',
          text: `${cleanName} successfully ${editingDoctor ? 'updated' : 'added to roster'}.`,
        });
        setIsModalOpen(false);
        await loadData();
      } else {
        setFormError(res.message || 'Failed to save doctor profile');
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDoctor = async (doc: DoctorWithBranches) => {
    // Admin doctors cannot be deleted
    if (doc.is_admin_doctor) {
      setStatusMessage({ type: 'error', text: 'Admin doctors cannot be removed or deleted.' });
      return;
    }

    const displayName = formatDoctorDisplayName(doc.full_name);
    const confirm = window.confirm(
      `Are you sure you want to remove ${displayName} from the active clinic roster?`
    );
    if (!confirm) return;

    setIsLoading(true);
    try {
      const res = await adminDeleteDoctor(doc.id, selectedClinicId, effectiveAdminPin);
      if (res.success) {
        clearDoctorsCacheLocal();
        setStatusMessage({ type: 'success', text: `${displayName} deactivated.` });
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Failed to deactivate doctor.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Error deactivating doctor.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <EcgActionLoader isLoading={isLoading} fullscreen={true} />

      {/* Clean Header */}
      <div className="bg-white rounded-2xl border border-[#ECEEF2] p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-bold text-[#16191E]">
              Doctor Management
            </h2>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {visibleDoctors.length} {visibleDoctors.length === 1 ? 'Doctor' : 'Doctors'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {!isAdminUser && lockedBranchName
              ? `Manage doctors and daily quotas for ${lockedBranchName}.`
              : `Manage doctors, specializations, daily quotas, and branch allocations for ${activeClinicMeta.name}.`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Doctor</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Doctor Directory Grid */}
      {visibleDoctors.length === 0 && !isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#ECEEF2]">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">No Doctors Found</h4>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Add New Doctor&quot; above to add a doctor for this clinic.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleDoctors.map((doc) => {
            const isAdmin = Boolean(doc.is_admin_doctor);
            const canManageDoctor = isAdminUser || (!isAdmin && (!lockedLocationId || doc.location_id === lockedLocationId));
            const formattedName = formatDoctorDisplayName(doc.full_name);
            const initials = formattedName
              .replace(/^dr\.?\s+/i, '')
              .split(' ')
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <motion.div
                key={doc.id}
                layout
                className="bg-white rounded-2xl border border-[#ECEEF2] p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition duration-150"
              >
                <div>
                  {/* Top: Avatar, Name, Specialization */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/60 flex items-center justify-center text-[#2563EB] font-bold text-xs flex-shrink-0">
                      {initials || 'DR'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {formattedName}
                        </h4>
                        {isAdmin && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {doc.specialization}
                      </p>
                    </div>
                  </div>

                  {/* Credentials / Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-2.5 px-3 bg-slate-50/70 rounded-xl border border-slate-100 my-3 text-slate-600">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Reg. No</span>
                      <span className="font-semibold text-slate-800 text-xs truncate block">{doc.reg_no || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Daily Quota</span>
                      <span className="font-semibold text-slate-800 text-xs">{doc.daily_quota || 30} pts</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Chamber PIN</span>
                      <span className="font-mono font-semibold text-blue-700 text-xs">{doc.chamber_pin || '••••'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Today&apos;s Queue</span>
                      <span className="font-semibold text-emerald-700 text-xs">{doc.today_patient_count ?? 0} active</span>
                    </div>
                  </div>

                  {/* Branch Scope */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Branch Scope
                    </span>
                    {isAdmin || doc.is_all_branches || !doc.location_id ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>All Branches (Org-wide)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        <span>{doc.branch_name || 'Assigned Branch'}</span>
                        {doc.branch_code && (
                          <span className="text-blue-500 font-mono text-[10px]">({doc.branch_code})</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  {canManageDoctor ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(doc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                        title="Edit Doctor"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      {!isAdmin && !doc.is_admin_doctor && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDoctor(doc)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                          title="Delete Doctor"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Delete</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium italic">
                      Managed by Clinic Admin
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Doctor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800">
                  {editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveDoctor} className="p-6 overflow-y-auto space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Doctor Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Dr. Faisal Khan"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Specialization *
                    </label>
                    <select
                      value={formSpec}
                      onChange={(e) => setFormSpec(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden"
                    >
                      {SPECIALIZATION_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="Other">Other (Custom)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Council Reg No *
                    </label>
                    <input
                      type="text"
                      required
                      value={formRegNo}
                      onChange={(e) => setFormRegNo(e.target.value)}
                      placeholder="e.g. KMC-45892"
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {formSpec === 'Other' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Custom Specialization Title
                    </label>
                    <input
                      type="text"
                      required
                      value={formCustomSpec}
                      onChange={(e) => setFormCustomSpec(e.target.value)}
                      placeholder="e.g. Consultant Pulmonologist"
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Daily Patient Quota (1-200)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={formQuota}
                      onChange={(e) => setFormQuota(parseInt(e.target.value, 10) || 30)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Chamber PIN (4-Digits) {editingDoctor ? '(Leave blank to keep)' : '*'}
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={formPin}
                      onChange={(e) => setFormPin(e.target.value)}
                      placeholder={editingDoctor ? '•••• (Unchanged)' : 'e.g. 1234'}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden tracking-wider"
                    />
                  </div>
                </div>

                {/* Admin Doctor Toggle (Clinic Admin only) */}
                {isAdminUser && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="adminDoctorCheckbox"
                      checked={formIsAdmin}
                      onChange={(e) => setFormIsAdmin(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="adminDoctorCheckbox" className="text-xs text-slate-700 cursor-pointer">
                      <span className="font-semibold text-slate-800 block">
                        Admin Doctor
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Grants administrative privileges and access across all clinic branches.
                      </span>
                    </label>
                  </div>
                )}

                {/* Branch Location Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branch Allocation
                  </label>
                  <select
                    disabled={formIsAdmin || (!isAdminUser && Boolean(lockedLocationId))}
                    value={!isAdminUser && lockedLocationId ? lockedLocationId : (formIsAdmin ? '' : formLocationId)}
                    onChange={(e) => setFormLocationId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">All Branches (Floating / Clinic Director)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branch_name} {b.branch_code ? `(${b.branch_code})` : ''}
                      </option>
                    ))}
                  </select>
                  {!isAdminUser && lockedLocationId ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Scoped to your active branch ({lockedBranchName || 'Current Branch'}).
                    </p>
                  ) : formIsAdmin ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Admin doctors operate across all clinic branches automatically.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Select a specific branch, or choose &ldquo;All Branches&rdquo; for multi-branch coverage.
                    </p>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : editingDoctor ? 'Save Changes' : 'Create Doctor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DoctorManagementSettings;
