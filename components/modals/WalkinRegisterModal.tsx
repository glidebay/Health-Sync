'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone } from 'lucide-react';
import { validateMobileNumber } from '@/lib/phoneValidation';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-[#ECEEF2] mx-2 sm:mx-4 max-h-[90dvh] overflow-y-auto relative overflow-hidden"
          >
            <EcgActionLoader isLoading={isSubmitting} text="Registering walk-in patient..." />
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#16191E]">Register Walk-in Patient</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-black cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4" noValidate={false}>
              <div>
                <label className="text-xs font-semibold text-[#8A909D] block mb-1">
                  Patient Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  minLength={2}
                  placeholder="Full name (e.g. Ramesh Kumar)"
                  value={walkinName}
                  onChange={(e) => {
                    e.target.setCustomValidity('');
                    setWalkinName(e.target.value);
                  }}
                  className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8A909D] block mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    required
                    placeholder="e.g. 98460 12345 or +91 98460 12345"
                    value={walkinPhone}
                    onChange={(e) => {
                      e.target.setCustomValidity('');
                      setWalkinPhone(e.target.value);
                    }}
                    className="w-full p-2.5 pl-9 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                  />
                  <Phone className="w-4 h-4 absolute left-3 top-3 pointer-events-none text-gray-400" />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-1/3">
                  <label className="text-xs font-semibold text-[#8A909D] block mb-1">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="120"
                    placeholder="Age"
                    value={walkinAge}
                    onChange={(e) => setWalkinAge(e.target.value)}
                    className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
                <div className="w-2/3">
                  <label className="text-xs font-semibold text-[#8A909D] block mb-1">Gender</label>
                  <select
                    value={walkinGender}
                    onChange={(e) => setWalkinGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-sm outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8A909D] block mb-1">
                  Consultation Priority
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWalkinPriority?.('Normal')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      walkinPriority !== 'Urgent'
                        ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] shadow-2xs font-bold'
                        : 'bg-[#F8F9FB] border-[#ECEEF2] text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>Normal Queue</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkinPriority?.('Urgent')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      walkinPriority === 'Urgent'
                        ? 'bg-red-50 border-red-500 text-red-600 shadow-2xs font-bold'
                        : 'bg-[#F8F9FB] border-[#ECEEF2] text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span>Urgent (Quota Bypass)</span>
                  </button>
                </div>
                {walkinPriority === 'Urgent' && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5 leading-snug">
                    ⚡ <strong>Urgent Triage:</strong> Authorized to bypass daily consultation quota for emergency care.
                  </p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer mt-2"
              >
                Queue Patient
              </motion.button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default WalkinRegisterModal;
