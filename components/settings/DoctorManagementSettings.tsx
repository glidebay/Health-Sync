'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Building2,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  X,
  MapPin,
  Users,
  Award,
  AlertCircle,
  Search,
} from 'lucide-react';
import {
  DoctorWithBranches,
  getDoctorsByClinic,
  adminUpsertDoctorWithBranches,
  adminDeleteDoctor,
} from '@/lib/doctorService';
import { fetchClinicLocations } from '@/lib/supabaseService';
import { DbClinicLocation } from '@/types/database';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorWithBranches | null>(null);

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
    setFormPin('');
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
      setFormError('Please assign at least one physical clinic branch');
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
      `Are you sure you want to deactivate ${displayName} from the active clinic roster?`
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

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((doc) => {
      const name = (doc.full_name || '').toLowerCase();
      const spec = (doc.specialization || '').toLowerCase();
      const reg = (doc.reg_no || '').toLowerCase();
      const branchesStr = (doc.assigned_branches || [])
        .map((b) => b.branch_name.toLowerCase())
        .join(' ');
      return name.includes(q) || spec.includes(q) || reg.includes(q) || branchesStr.includes(q);
    });
  }, [doctors, searchQuery]);

  const adminDoctorsCount = useMemo(() => {
    return doctors.filter((d) => d.is_admin_doctor).length;
  }, [doctors]);

  const totalDailyCapacity = useMemo(() => {
    return doctors.reduce((acc, d) => acc + (d.daily_quota || 30), 0);
  }, [doctors]);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-4">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Total Physicians
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">
                <AnimatedCounter target={doctors.length} />
              </span>
              <span className="inline-flex items-center text-xs font-semibold text-emerald-500">
                Active <span className="text-slate-400 font-normal text-[11px] ml-1">roster</span>
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-blue-700 to-blue-500 shadow-md shadow-blue-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Stethoscope className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Admin Physicians
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">
                <AnimatedCounter target={adminDoctorsCount} />
              </span>
              <span className="inline-flex items-center text-xs font-semibold text-amber-600">
                Full access <span className="text-slate-400 font-normal text-[11px] ml-1">rights</span>
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-amber-500 to-orange-400 shadow-md shadow-amber-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Award className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Assigned Branches
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">
                <AnimatedCounter target={branches.length} />
              </span>
              <span className="inline-flex items-center text-xs font-semibold text-emerald-500">
                Clinic <span className="text-slate-400 font-normal text-[11px] ml-1">locations</span>
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Building2 className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Daily Capacity
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">
                <AnimatedCounter target={totalDailyCapacity} />
              </span>
              <span className="inline-flex items-center text-xs font-semibold text-blue-600">
                Patients <span className="text-slate-400 font-normal text-[11px] ml-1">/ day</span>
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-indigo-600 to-blue-500 shadow-md shadow-indigo-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>
      </section>

      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                HEALTHSYNC • MEDICAL DIRECTORY
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-[#2563EB] border border-blue-100">
                {activeClinicMeta.name}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              Doctor Management
            </h2>
            <p className="text-xs text-slate-400">
              Manage physician profiles, chamber PINs, consultation quotas, and branch allocations.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search physician or branch..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Doctor</span>
            </motion.button>
          </div>
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

      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 text-slate-400 text-xs flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading physicians for {activeClinicMeta.name}...</span>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">
            {searchQuery ? 'No matching doctors found' : 'No Doctors Configured'}
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery
              ? 'Try modifying your search criteria.'
              : 'Click "Add New Doctor" above to onboard a physician for this clinic.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDoctors.map((doc) => {
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

            const branchDisplay = isAdmin
              ? 'All Branches'
              : doc.assigned_branches && doc.assigned_branches.length > 0
              ? doc.assigned_branches.map((b) => b.branch_name).join(', ')
              : 'No branch assigned';

            return (
              <motion.div
                key={doc.id}
                layout
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_20px_0_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0 ${
                          isAdmin
                            ? 'bg-gradient-to-tl from-amber-500 to-orange-400 shadow-amber-500/20'
                            : 'bg-gradient-to-tl from-blue-700 to-blue-500 shadow-blue-500/20'
                        }`}
                      >
                        {initials || 'DR'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800 truncate">
                            {formattedName}
                          </h4>
                          {isAdmin && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {doc.specialization}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Roster" />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate text-xs font-medium">{branchDisplay}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>
                          <strong className="text-slate-700 font-semibold">{doc.daily_quota || 30}</strong> pts/day
                        </span>
                      </div>
                      <div className="font-mono text-slate-400 text-[11px]">
                        {doc.reg_no || 'Reg Pending'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(doc)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-medium text-xs border border-slate-200/70 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoctor(doc)}
                    className="py-1.5 px-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-medium text-xs transition flex items-center justify-center cursor-pointer"
                    title="Deactivate Doctor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                    <Stethoscope className="w-4.5 h-4.5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingDoctor
                        ? `Edit ${formatDoctorDisplayName(editingDoctor.full_name)}`
                        : 'Onboard New Doctor'}
                    </h3>
                    <p className="text-[11px] text-slate-400">{activeClinicMeta.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveDoctor} className="p-6 overflow-y-auto space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Doctor Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Dr. Faisal Khan"
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Specialization *
                    </label>
                    <select
                      value={formSpec}
                      onChange={(e) => setFormSpec(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden transition"
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Council Reg No *
                    </label>
                    <input
                      type="text"
                      required
                      value={formRegNo}
                      onChange={(e) => setFormRegNo(e.target.value)}
                      placeholder="e.g. KMC-45892"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden transition"
                    />
                  </div>
                </div>

                {formSpec === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Custom Specialization Title
                    </label>
                    <input
                      type="text"
                      required
                      value={formCustomSpec}
                      onChange={(e) => setFormCustomSpec(e.target.value)}
                      placeholder="e.g. Consultant Pulmonologist"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden transition"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Daily Patient Quota (1-200)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={formQuota}
                      onChange={(e) => setFormQuota(parseInt(e.target.value, 10) || 30)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Chamber PIN (4-Digits) {editingDoctor ? '(Optional)' : '*'}
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={formPin}
                      onChange={(e) => setFormPin(e.target.value)}
                      placeholder={editingDoctor ? '•••• (Unchanged)' : 'e.g. 1234'}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden transition tracking-wider"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/50 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="adminDoctorCheckbox"
                    checked={formIsAdmin}
                    onChange={(e) => setFormIsAdmin(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="adminDoctorCheckbox" className="text-xs text-slate-700 cursor-pointer">
                    <strong className="text-amber-900 block font-semibold">
                      Grant Admin Doctor Privileges
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Authorizes this physician across all branches in {activeClinicMeta.name} with administrative rights.
                    </span>
                  </label>
                </div>

                {!formIsAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                                ? 'bg-blue-50 text-blue-800 border-blue-200 font-semibold'
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

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl shadow-sm shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
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