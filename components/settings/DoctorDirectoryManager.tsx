'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCog,
  ShieldCheck,
  Users,
  Lock,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Stethoscope,
  Minus,
} from 'lucide-react';
import { DbDoctor } from '@/types/database';
import {
  getDoctors,
  addDoctorDb,
  updateDoctorProfileDb,
  deleteDoctorDb,
} from '@/lib/supabaseService';

interface DoctorDirectoryManagerProps {
  onDoctorUpdated?: () => void;
}

const MEDICAL_SPECIALTIES = [
  'General Medicine',
  'Consultant Physician & Diabetologist',
  'Pediatrics & Child Health',
  'Cardiology & Vascular Medicine',
  'Dermatology & Cosmetology',
  'Orthopedics & Joint Replacement',
  'Obstetrics & Gynecology',
  'ENT & Head-Neck Surgery',
  'Ophthalmology & Eye Care',
  'Pulmonology & Respiratory Care',
  'Gastroenterology & Hepatology',
  'Neurology & Brain Sciences',
  'Psychiatry & Behavioral Health',
  'General Surgery',
  'Dental & Maxillofacial Care',
];

function getInitials(name: string): string {
  if (!name) return 'DR';
  const clean = name.replace(/^dr\.?\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function DoctorDirectoryManager({ onDoctorUpdated }: DoctorDirectoryManagerProps) {
  const [doctors, setDoctors] = useState<DbDoctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DbDoctor | null>(null);

  const [formName, setFormName] = useState('');
  const [formSpecialization, setFormSpecialization] = useState('General Medicine');
  const [formRegNo, setFormRegNo] = useState('');
  const [formDailyQuota, setFormDailyQuota] = useState(30);
  const [formPin, setFormPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [formStatus, setFormStatus] = useState<boolean>(true);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [doctorToDelete, setDoctorToDelete] = useState<DbDoctor | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const loadDoctors = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDoctors();
      setDoctors(data);
    } catch (err) {
      console.warn('Error loading doctors directory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const handleOpenAdd = () => {
    setEditingDoctor(null);
    setFormName('');
    setFormSpecialization('General Medicine');
    setFormRegNo('');
    setFormDailyQuota(30);
    setFormPin('');
    setShowPin(false);
    setFormStatus(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (doc: DbDoctor) => {
    setEditingDoctor(doc);
    setFormName(doc.full_name);
    setFormSpecialization(doc.specialization || 'General Medicine');
    setFormRegNo(doc.reg_no || '');
    setFormDailyQuota(doc.daily_quota ? Math.max(1, Math.min(200, doc.daily_quota)) : 30);
    setFormPin('');
    setShowPin(false);
    setFormStatus(doc.is_active !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formName.trim();
    if (!cleanName || cleanName.length < 2) {
      setFormError('Please enter a valid doctor name.');
      return;
    }

    const cleanRegNo = formRegNo.trim();
    if (!cleanRegNo) {
      setFormError('Medical Council Registration Number is required.');
      return;
    }

    const duplicate = doctors.find(
      (d) =>
        (!editingDoctor || d.id !== editingDoctor.id) &&
        (d.reg_no || '').toLowerCase() === cleanRegNo.toLowerCase()
    );
    if (duplicate) {
      setFormError(`Council Registration Number '${cleanRegNo}' is already registered to ${duplicate.full_name}.`);
      return;
    }

    const quota = Math.max(1, Math.min(200, Number(formDailyQuota) || 30));

    if (!editingDoctor) {
      if (!formPin.trim() || formPin.trim().length < 4) {
        setFormError('Security PIN must be at least 4 digits for new doctor onboarding.');
        return;
      }
    } else {
      if (formPin.trim() && formPin.trim().length < 4) {
        setFormError('New Security PIN must be at least 4 digits (or leave blank to keep current PIN).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingDoctor) {
        const updatePayload: Parameters<typeof updateDoctorProfileDb>[1] = {
          full_name: cleanName,
          specialization: formSpecialization,
          reg_no: cleanRegNo,
          daily_quota: quota,
          is_active: formStatus,
        };
        if (formPin.trim()) {
          updatePayload.pin_code = formPin.trim();
        }

        const res = await updateDoctorProfileDb(editingDoctor.id, updatePayload);
        if (!res.success) {
          setFormError(res.error || 'Failed to update doctor profile');
          return;
        }

        showToast('success', `${cleanName}'s profile updated successfully.`);
      } else {
        const res = await addDoctorDb({
          full_name: cleanName,
          specialization: formSpecialization,
          reg_no: cleanRegNo,
          daily_quota: quota,
          pin_code: formPin.trim(),
          is_active: formStatus,
        });

        if (!res.success) {
          setFormError(res.error || 'Failed to onboard doctor');
          return;
        }

        showToast('success', `${cleanName} successfully onboarded to directory!`);
      }

      setIsModalOpen(false);
      await loadDoctors();
      onDoctorUpdated?.();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDoctor = async (doctorId: string) => {
    try {
      const res = await deleteDoctorDb(doctorId);
      if (!res.success) {
        showToast('error', res.error || 'Failed to delete doctor');
        return;
      }

      showToast('success', 'Doctor removed from medical directory.');
      setDoctorToDelete(null);
      await loadDoctors();
      onDoctorUpdated?.();
    } catch (err: any) {
      showToast('error', err.message || 'Error deleting doctor');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10'
                : 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-500/10'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <UserCog className="w-4 h-4 text-blue-600 flex-shrink-0" />
              Doctor Directory &amp; Onboarding
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              {doctors.length} {doctors.length === 1 ? 'Doctor' : 'Doctors'} Registered
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Manage consulting physicians, council licensing credentials, consultation capacity quotas, and chamber security access PINs.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Add New Doctor</span>
        </motion.button>
      </div>

      {/* Directory Cards Grid */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading doctor directory...</p>
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-200 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Stethoscope className="w-6 h-6 stroke-[1.8]" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Doctors Onboarded Yet</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Add doctors with their council registration number and security PIN to enable chamber consultations.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Onboard First Doctor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {doctors.map((doc) => {
            const isActive = doc.is_active !== false;
            const initials = getInitials(doc.full_name);

            return (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col justify-between group min-w-0"
              >
                <div>
                  {/* Top: Avatar, Name, Specialization & Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tl from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 tracking-tight truncate" title={doc.full_name}>
                          {doc.full_name}
                        </h4>
                        <span className="text-xs font-semibold text-blue-600 block truncate" title={doc.specialization || 'General Medicine'}>
                          {doc.specialization || 'General Medicine'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => handleOpenEdit(doc)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                        title="Edit doctor profile"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => setDoctorToDelete(doc)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete doctor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Badges & Metrics */}
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                        }`}
                      />
                      {isActive ? 'Active Status' : 'Inactive'}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                      PIN Protected
                    </span>
                  </div>

                  {/* Credentials / Quota Details */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        Council Reg No:
                      </span>
                      <span className="font-bold text-slate-800 font-mono text-xs">
                        {doc.reg_no || 'KMC-45892'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Daily Quota:
                      </span>
                      <span className="font-bold text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded-lg border border-blue-100 text-xs">
                        {doc.daily_quota || 30} Patients / Day
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Status Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Chamber PIN Access</span>
                  <span className={isActive ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'}>
                    {isActive ? 'Authorized' : 'Suspended'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Doctor Onboarding & Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <UserCog className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingDoctor ? 'Edit Doctor Profile' : 'Onboard New Doctor'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {editingDoctor
                        ? 'Update medical credentials and consultation limits'
                        : 'Register medical credentials and setup chamber access PIN'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveDoctor} className="space-y-3.5">
                {/* Full Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Dr. Sunny / Dr. Aditi Sharma"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                {/* Specialization Dropdown */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Specialization <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formSpecialization}
                    onChange={(e) => setFormSpecialization(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition cursor-pointer"
                  >
                    {MEDICAL_SPECIALTIES.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Council Reg No. */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Council Registration Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formRegNo}
                    onChange={(e) => setFormRegNo(e.target.value)}
                    placeholder="e.g. KMC-45892 or MCI-98765"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition font-mono uppercase"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Must be unique per doctor across the clinical registry.
                  </span>
                </div>

                {/* Daily Quota Number Stepper (Min 1, Max 200) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Daily Consultation Quota (1 – 200 Patients) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setFormDailyQuota((prev) => Math.max(1, prev - 5))}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      required
                      min={1}
                      max={200}
                      value={formDailyQuota}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val)) setFormDailyQuota(1);
                        else setFormDailyQuota(Math.max(1, Math.min(200, val)));
                      }}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setFormDailyQuota((prev) => Math.min(200, prev + 5))}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Blocks non-emergency appointment bookings once patient limit is reached.
                  </span>
                </div>

                {/* PIN Setup with Show/Hide Option */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Chamber Security PIN Setup {editingDoctor ? '(Optional)' : <span className="text-rose-500">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={formPin}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                        setFormPin(digitsOnly);
                      }}
                      maxLength={6}
                      placeholder={
                        editingDoctor
                          ? 'Leave blank to preserve current hashed PIN'
                          : 'Enter 4 – 6 digit PIN (e.g. 1234)'
                      }
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                      title={showPin ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    PINs are salted and cryptographically hashed with Bcrypt prior to persistence.
                  </span>
                </div>

                {/* Status: Active / Inactive Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl pt-2">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Doctor Availability Status</span>
                    <span className="text-[11px] text-slate-400">
                      {formStatus ? 'Doctor is active and taking patient consultations' : 'Temporarily suspended or on leave'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 bg-white p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFormStatus(true)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                        formStatus
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus(false)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                        !formStatus
                          ? 'bg-slate-200 text-slate-700'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isSubmitting ? 'Saving...' : editingDoctor ? 'Update Profile' : 'Onboard Doctor'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Alert Modal */}
      <AnimatePresence>
        {doctorToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5 stroke-[2]" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Remove {doctorToDelete.full_name}?
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to remove this doctor from the medical directory? They will no longer be able to log in or consult patients.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDoctorToDelete(null)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDoctor(doctorToDelete.id)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  Yes, Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DoctorDirectoryManager;

