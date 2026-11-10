'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  KeyRound,
  X,
  MapPin,
  Users,
  Award,
  Phone,
  AlertCircle,
  Lock,
  UserCheck,
} from 'lucide-react';
import {
  DoctorWithBranches,
  getDoctorsByClinic,
  adminUpsertDoctorWithBranches,
  adminDeleteDoctor,
} from '@/lib/doctorService';
import { fetchClinicLocations } from '@/lib/supabaseService';
import { DbClinicLocation } from '@/types/database';

export const CLINIC_OPTIONS = [
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
  const clean = (fullName || '').trim();
  if (/^dr\.?\s+/i.test(clean)) return clean;
  return `Dr. ${clean}`;
}

export function DoctorManagementSettings({ currentClinicId }: DoctorManagementSettingsProps) {
  const effectiveClinicId = useMemo(() => {
    if (currentClinicId) return currentClinicId;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('healthsync_active_clinic_id');
      if (stored) return stored;
    }
    return CLINIC_OPTIONS[0].id;
  }, [currentClinicId]);

  const [selectedClinicId, setSelectedClinicId] = useState<string>(effectiveClinicId);

  useEffect(() => {
    if (effectiveClinicId) {
      setSelectedClinicId(effectiveClinicId);
    }
  }, [effectiveClinicId]);

  const activeClinicMeta = useMemo(() => {
    return (
      CLINIC_OPTIONS.find((c) => c.id === selectedClinicId) || {
        id: selectedClinicId,
        name: 'Clinic Organization',
        badge: 'HQ',
      }
    );
  }, [selectedClinicId]);

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
    try {
      const [docList, branchList] = await Promise.all([
        getDoctorsByClinic(selectedClinicId),
        fetchClinicLocations(selectedClinicId),
      ]);
      setDoctors(docList);
      setBranches(branchList);
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

    const cleanName = formName.trim();
    if (!cleanName) {
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
      {/* Header & Clinic Isolation Banner */}
      <div className="bg-white rounded-2xl border border-[#ECEEF2] p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-2xs">
                <Stethoscope className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#16191E] flex items-center gap-2">
                  <span>Doctor Roster &amp; Branch Allocations</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Admin Only
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage physician credentials, chamber PINs, daily quotas, and branch-level access control.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Doctor</span>
          </button>
        </div>

        {/* Dedicated Scoped Clinic Badge (Strict Tenant Isolation) */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#2563EB]" />
              <span>Clinic Organization:</span>
            </span>
            <div className="px-3.5 py-1.5 rounded-xl bg-blue-50/90 text-[#2563EB] border border-blue-200/80 text-xs font-bold shadow-2xs flex items-center gap-2">
              <span>{activeClinicMeta.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 font-semibold uppercase tracking-wider">
                {activeClinicMeta.badge}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200/60 px-3 py-1 rounded-lg">
            {doctors.length} {doctors.length === 1 ? 'Physician' : 'Physicians'} Configured
          </span>
        </div>
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
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 text-slate-400 text-xs flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading physicians for {activeClinicMeta.name}...</span>
        </div>
      ) : doctors.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">No Doctors Configured</h4>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Add New Doctor&quot; above to onboard a doctor for this clinic.
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
                className="bg-white rounded-2xl border border-[#ECEEF2] p-5 shadow-2xs flex flex-col justify-between hover:border-blue-300 hover:shadow-xs transition duration-200 relative group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-[#2563EB] font-bold text-xs flex-shrink-0 shadow-2xs">
                        {initials || 'DR'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {formattedName}
                          </h4>
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                              <Award className="w-3 h-3 text-amber-600" />
                              <span>Admin Doctor (All Branches)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span>Standard OPD Doctor</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-[#2563EB] mt-0.5 truncate">
                          {doc.specialization}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(doc)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                        title="Edit Doctor Profile"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoctor(doc)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Deactivate Doctor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Credentials / Details */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 py-2.5 border-y border-slate-100/90 my-2 bg-slate-50/40 rounded-xl px-3">
                    <div>
                      <span className="text-slate-400">Reg No: </span>
                      <span className="font-bold text-slate-700">{doc.reg_no || 'Pending'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Daily Quota: </span>
                      <span className="font-bold text-slate-700">{doc.daily_quota || 30} Patients</span>
                    </div>
                  </div>

                  {/* Branch Assignments */}
                  <div className="mt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      {isAdmin ? 'Clinic Scope:' : 'Assigned Branches:'}
                    </span>
                    {isAdmin ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50/70 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Authorized for all branches under {activeClinicMeta.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {doc.assigned_branches && doc.assigned_branches.length > 0 ? (
                          doc.assigned_branches.map((b) => (
                            <span
                              key={b.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100"
                            >
                              <MapPin className="w-3 h-3 text-blue-500" />
                              <span>{b.branch_name}</span>
                              {b.branch_code && <span className="opacity-70 font-mono">({b.branch_code})</span>}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-amber-600 italic">No physical branches assigned</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer status */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Chamber PIN Configured</span>
                  </span>
                  <span className="text-slate-400">
                    Status: <strong className="text-emerald-700">Active</strong>
                  </span>
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
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingDoctor
                      ? `Edit ${formatDoctorDisplayName(editingDoctor.full_name)}`
                      : `Onboard New Doctor (${activeClinicMeta.name})`}
                  </h3>
                </div>
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
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="adminDoctorCheckbox"
                    checked={formIsAdmin}
                    onChange={(e) => setFormIsAdmin(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="adminDoctorCheckbox" className="text-xs text-slate-700 cursor-pointer">
                    <strong className="text-amber-900 block font-bold">
                      Grant Admin Doctor Privileges (All Branches in {activeClinicMeta.name})
                    </strong>
                    <span className="text-[11px] text-slate-600">
                      Authorizes this doctor across all branches in this clinic organization with permission to manage settings and schedules.
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
