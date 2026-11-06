'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  UserCog,
  Stethoscope,
  ShieldCheck,
  Users,
  Lock,
  Save,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Phone,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { DbDoctor } from '@/types/database';
import { updateDoctorProfileDb, getDoctors } from '@/lib/supabaseService';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

interface DoctorProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: DbDoctor | null;
  onSave: (updatedDoc: DbDoctor) => void;
  existingDoctors?: DbDoctor[];
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

export function DoctorProfileEditModal({
  isOpen,
  onClose,
  doctor,
  onSave,
  existingDoctors,
}: DoctorProfileEditModalProps) {
  const [fullName, setFullName] = useState('');
  const [specialization, setSpecialization] = useState('General Medicine');
  const [regNo, setRegNo] = useState('');
  const [dailyQuota, setDailyQuota] = useState(30);
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (doctor && isOpen) {
      setFullName(doctor.full_name || '');
      setSpecialization(doctor.specialization || 'General Medicine');
      setRegNo(doctor.reg_no || '');
      setDailyQuota(
        doctor.daily_quota ? Math.max(1, Math.min(200, doctor.daily_quota)) : 30
      );
      setNewPin('');
      setShowPin(false);
      setIsActive(doctor.is_active !== false);
      setPhone(doctor.phone || '');
      setEmail(doctor.email || '');
      setErrorMsg('');
    }
  }, [doctor, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Doctor full name must be at least 2 characters long.');
      return;
    }

    const cleanRegNo = regNo.trim();
    if (!cleanRegNo) {
      setErrorMsg('Council Registration Number is required.');
      return;
    }

    // Duplicate Council Registration Number check
    let allDoctors = existingDoctors;
    if (!allDoctors || allDoctors.length === 0) {
      allDoctors = await getDoctors();
    }
    const duplicate = allDoctors.find(
      (d) =>
        d.id !== doctor.id &&
        (d.reg_no || '').toLowerCase() === cleanRegNo.toLowerCase()
    );
    if (duplicate) {
      setErrorMsg(
        `Council Registration Number '${cleanRegNo}' is already registered to ${duplicate.full_name}.`
      );
      return;
    }

    // Daily quota range check (1 - 200)
    const quotaNum = Math.max(1, Math.min(200, Number(dailyQuota) || 30));

    // PIN check
    if (newPin.trim() && newPin.trim().length < 4) {
      setErrorMsg('Security PIN must be at least 4 digits if changing.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await updateDoctorProfileDb(doctor.id, {
        full_name: cleanName,
        specialization: specialization.trim(),
        reg_no: cleanRegNo,
        daily_quota: quotaNum,
        pin_code: newPin.trim() || undefined,
        is_active: isActive,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });

      if (res.success && res.doctor) {
        onSave(res.doctor);
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to update doctor profile');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#F8F9FB] flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
                  <UserCog className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Edit Doctor Profile</h3>
                  <p className="text-[11px] text-slate-400">
                    Update physician credentials, quota limits &amp; chamber access
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Doctor Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Doctor Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Sunny / Dr. Aditi Sharma"
                    className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                  <Stethoscope className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Specialization Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Specialization <span className="text-rose-500">*</span>
                </label>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  {MEDICAL_SPECIALTIES.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Council Reg No & Daily Quota Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Council Reg No */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Council Reg No. <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      placeholder="e.g. KMC-45892"
                      className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 font-mono uppercase outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Daily Quota Stepper (Min 1, Max 200) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Daily Quota (1 – 200) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setDailyQuota((prev) => Math.max(1, prev - 5))}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition cursor-pointer flex-shrink-0"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        required
                        value={dailyQuota}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (isNaN(val)) setDailyQuota(1);
                          else setDailyQuota(Math.max(1, Math.min(200, val)));
                        }}
                        className="w-full h-10 px-2 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setDailyQuota((prev) => Math.min(200, prev + 5))}
                      className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition cursor-pointer flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Phone & Email Coordinates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Contact Phone
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="doctor@healthsync.clinic"
                      className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* PIN Setup with Show/Hide Option */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Change Security PIN <span className="text-[10px] text-slate-400 font-normal">(Leave blank to keep current PIN)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="•••• (New 4 – 6 digit PIN)"
                    className="w-full h-10 pl-9 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition tracking-widest"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                    title={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Status Toggle: Active / Inactive */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Doctor Availability Status</span>
                  <span className="text-[11px] text-slate-400">
                    {isActive ? 'Doctor actively takes consultations & walk-ins' : 'Temporarily suspended or on leave'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 bg-white p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsActive(true)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsActive(false)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                      !isActive
                        ? 'bg-slate-200 text-slate-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <EcgActionLoader isLoading={true} size="sm" text="Saving..." />
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default DoctorProfileEditModal;
