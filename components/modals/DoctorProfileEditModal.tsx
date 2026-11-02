'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserCog, Stethoscope, Hash, Users, Lock, Save } from 'lucide-react';
import { DbDoctor } from '@/types/database';
import { updateDoctorProfileDb } from '@/lib/supabaseService';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

interface DoctorProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: DbDoctor | null;
  onSave: (updatedDoc: DbDoctor) => void;
}

export function DoctorProfileEditModal({
  isOpen,
  onClose,
  doctor,
  onSave,
}: DoctorProfileEditModalProps) {
  const [fullName, setFullName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [regNo, setRegNo] = useState('');
  const [dailyQuota, setDailyQuota] = useState('30');
  const [newPin, setNewPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (doctor && isOpen) {
      setFullName(doctor.full_name || '');
      setSpecialization(doctor.specialization || '');
      setRegNo(doctor.reg_no || '');
      setDailyQuota(String(doctor.daily_quota || 30));
      setNewPin('');
      setErrorMsg('');
    }
  }, [doctor, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
      setErrorMsg('Doctor name must be at least 2 characters long.');
      return;
    }

    if (newPin && newPin.trim().length !== 4) {
      setErrorMsg('Security PIN must be exactly 4 digits if changing.');
      return;
    }

    const quotaNum = parseInt(dailyQuota, 10);
    if (isNaN(quotaNum) || quotaNum < 1) {
      setErrorMsg('Daily consultation quota must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await updateDoctorProfileDb(doctor.id, {
        full_name: cleanName,
        specialization: specialization.trim(),
        reg_no: regNo.trim(),
        daily_quota: quotaNum,
        pin_code: newPin.trim() || undefined,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#ECEEF2] overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#ECEEF2] bg-[#F8F9FB]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
                  <UserCog className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#16191E]">Edit Doctor Profile</h3>
                  <p className="text-[11px] text-[#8A909D]">Update physician details & OPD consultation quota</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#16191E] mb-1">
                  Doctor Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Sunny"
                    className="w-full h-10 pl-9 pr-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:border-[#2563EB] focus:bg-white transition"
                  />
                  <Stethoscope className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#16191E] mb-1">
                  Specialization / Title
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. General Medicine / Consultant Physician"
                  className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:border-[#2563EB] focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#16191E] mb-1">
                    Registration No
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      placeholder="e.g. KMC-12345"
                      className="w-full h-10 pl-8 pr-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:border-[#2563EB] focus:bg-white transition"
                    />
                    <Hash className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#16191E] mb-1">
                    Daily Quota
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={dailyQuota}
                      onChange={(e) => setDailyQuota(e.target.value)}
                      placeholder="30"
                      className="w-full h-10 pl-8 pr-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:border-[#2563EB] focus:bg-white transition"
                    />
                    <Users className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#16191E] mb-1">
                  Change Security PIN <span className="text-[10px] text-gray-400 font-normal">(Leave empty to keep current)</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="•••• (New 4-digit PIN)"
                    className="w-full h-10 pl-9 pr-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] tracking-widest outline-none focus:border-[#2563EB] focus:bg-white transition"
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#ECEEF2]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
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

