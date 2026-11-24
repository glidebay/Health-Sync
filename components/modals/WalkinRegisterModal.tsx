'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { validateMobileNumber } from '@/lib/phoneValidation';
import EcgActionLoader from '@/components/loading/EcgActionLoader';
import { DbDoctor } from '@/types/database';

interface WalkinRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  walkinName: string;
  setWalkinName: (v: string) => void;
  walkinPhone: string;
  setWalkinPhone: (v: string) => void;
  walkinAge: string;
  setWalkinAge: (v: string) => void;
  walkinGender: 'Male' | 'Female' | 'Other';
  setWalkinGender: (v: 'Male' | 'Female' | 'Other') => void;
  walkinPriority?: 'Normal' | 'Urgent';
  setWalkinPriority?: (v: 'Normal' | 'Urgent') => void;
  availableDoctors?: DbDoctor[];
  selectedDoctorId?: string;
  setSelectedDoctorId?: (v: string) => void;
  allowQuotaOverride?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
}

export function WalkinRegisterModal({
  isOpen,
  onClose,
  walkinName,
  setWalkinName,
  walkinPhone,
  setWalkinPhone,
  walkinAge,
  setWalkinAge,
  walkinGender,
  setWalkinGender,
  walkinPriority = 'Normal',
  setWalkinPriority,
  availableDoctors = [],
  selectedDoctorId = '',
  setSelectedDoctorId,
  allowQuotaOverride = true,
  onSubmit,
  isSubmitting = false,
}: WalkinRegisterModalProps) {
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (nameInputRef.current) {
      const cleanName = walkinName.trim();
      if (!cleanName) {
        nameInputRef.current.setCustomValidity('Please fill out this field.');
        nameInputRef.current.reportValidity();
        return;
      }
      if (cleanName.length < 2) {
        nameInputRef.current.setCustomValidity('Patient name must be at least 2 characters long.');
        nameInputRef.current.reportValidity();
        return;
      }
      nameInputRef.current.setCustomValidity('');
    }

    if (phoneInputRef.current) {
      if (!walkinPhone.trim()) {
        phoneInputRef.current.setCustomValidity('Please fill out this field.');
        phoneInputRef.current.reportValidity();
        return;
      }
      const res = validateMobileNumber(walkinPhone);
      if (!res.isValid) {
        phoneInputRef.current.setCustomValidity(res.errorMessage || 'Please enter a valid 10-digit mobile number.');
        phoneInputRef.current.reportValidity();
        return;
      }
      phoneInputRef.current.setCustomValidity('');
    }

    onSubmit(e);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative"
          >
            <EcgActionLoader isLoading={isSubmitting} text="Registering walk-in patient..." />

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">
                Register Walk-in Patient
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-4" noValidate={false}>
              {/* Doctor Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedDoctorId || (availableDoctors[0]?.id ?? '')}
                  onChange={(e) => setSelectedDoctorId?.(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  {availableDoctors && availableDoctors.length > 0 ? (
                    availableDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.full_name ? doc.full_name.replace(/\s*\([^)]*\)/g, '').trim() : 'Doctor'}
                      </option>
                    ))
                  ) : (
                    <option value="">Default Doctor</option>
                  )}
                </select>
              </div>

              {/* Patient Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  minLength={2}
                  placeholder="e.g. Ramesh Kumar"
                  value={walkinName}
                  onChange={(e) => {
                    e.target.setCustomValidity('');
                    setWalkinName(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  required
                  placeholder="e.g. 9846012345"
                  value={walkinPhone}
                  onChange={(e) => {
                    e.target.setCustomValidity('');
                    setWalkinPhone(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Age & Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    placeholder="e.g. 35"
                    value={walkinAge}
                    onChange={(e) => setWalkinAge(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={walkinGender}
                    onChange={(e) => setWalkinGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Consultation Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Consultation Priority
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setWalkinPriority?.('Normal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      walkinPriority !== 'Urgent'
                        ? 'bg-blue-50 border-blue-200 text-[#2563EB]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Normal Queue</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkinPriority?.('Urgent')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      walkinPriority === 'Urgent'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>{allowQuotaOverride ? 'Urgent (Quota Bypass)' : 'Urgent (Triage)'}</span>
                  </button>
                </div>
                {walkinPriority === 'Urgent' && (
                  <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 leading-snug">
                    {allowQuotaOverride ? (
                      <>⚡ <strong>Urgent Triage:</strong> Authorized emergency care bypasses daily quota if capacity is reached.</>
                    ) : (
                      <>⚡ <strong>Urgent Triage:</strong> High priority emergency care in queue. <em>(Daily quota override is disabled in Settings)</em></>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Queueing...' : 'Queue Patient'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default WalkinRegisterModal;
