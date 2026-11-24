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
} from '@/lib/doctorService';
import { fetchClinicLocations } from '@/lib/supabaseService';
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

export function DoctorManagementSettings({ currentClinicId }: DoctorManagementSettingsProps) {
  const [clinicList, setClinicList] = useState<{ id: string; name: string; slug?: string }[]>([]);

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
  const [formBranchIds, setFormBranchIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  // Load doctors and branches for selected clinic ONLY
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    const startTime = Date.now();
    try {
      const [docList, branchList] = await Promise.all([
        getDoctorsByClinic(selectedClinicId),
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
  }, [selectedClinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    setFormBranchIds(branches.length > 0 ? [branches[0].id] : []);
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
    setFormBranchIds(doc.assigned_branch_ids || []);
    setFormError('');
    setIsModalOpen(true);
  };

  const toggleBranchSelection = (branchId: string) => {
    setFormBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
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

    if (!formIsAdmin && formBranchIds.length === 0) {
      setFormError('Please assign at least one physical clinic branch for standard OPD doctors');
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
        is_admin_doctor: formIsAdmin,
        is_active: true,
        branch_ids: formIsAdmin ? branches.map((b) => b.id) : formBranchIds,
      });

      if (res.success) {
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
    const displayName = formatDoctorDisplayName(doc.full_name);
    const confirm = window.confirm(
      `Are you sure you want to remove ${displayName} from the active clinic roster?`
    );
    if (!confirm) return;

    try {
      const res = await adminDeleteDoctor(doc.id);
      if (res.success) {
        setStatusMessage({ type: 'success', text: `${displayName} deactivated.` });
        await loadData();
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Failed to deactivate doctor.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Error deactivating doctor.' });
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
              {doctors.length} {doctors.length === 1 ? 'Doctor' : 'Doctors'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage doctors, specializations, daily quotas, and branch allocations for {activeClinicMeta.name}.
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
      {doctors.length === 0 && !isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#ECEEF2]">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">No Doctors Found</h4>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Add New Doctor&quot; above to add a doctor for this clinic.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {doctors.map((doc) => {
            const isAdmin = Boolean(doc.is_admin_doctor);
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
                  <div className="grid grid-cols-2 gap-2 text-xs py-2.5 px-3 bg-slate-50/70 rounded-xl border border-slate-100 my-3 text-slate-600">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Registration No.</span>
                      <span className="font-semibold text-slate-800 text-xs">{doc.reg_no || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Daily Quota</span>
                      <span className="font-semibold text-slate-800 text-xs">{doc.daily_quota || 30} patients</span>
                    </div>
                  </div>

                  {/* Branch Assignments */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                      {isAdmin ? 'Scope' : 'Branches'}
                    </span>
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>All Branches</span>
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {doc.assigned_branches && doc.assigned_branches.length > 0 ? (
                          doc.assigned_branches.map((b) => (
                            <span
                              key={b.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700"
                            >
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{b.branch_name}</span>
                              {b.branch_code && (
                                <span className="text-slate-400 font-mono text-[10px]">({b.branch_code})</span>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No branch assigned</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                    title="Edit Doctor"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoctor(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                    title="Delete Doctor"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Delete</span>
                  </button>
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

                {/* Admin Doctor Toggle */}
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

                {/* Branch Assignment Selector (Disabled if Admin Doctor) */}
                {!formIsAdmin && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Assign Physical Clinic Branches *
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                      {branches.map((b) => {
                        const isChecked = formBranchIds.includes(b.id);
                        return (
                          <label
                            key={b.id}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer border ${
                              isChecked
                                ? 'bg-blue-50 text-blue-800 border-blue-200 font-bold'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleBranchSelection(b.id)}
                                className="w-3.5 h-3.5 text-blue-600 rounded-sm"
                              />
                              <span>{b.branch_name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {b.branch_code || 'MAIN'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

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
