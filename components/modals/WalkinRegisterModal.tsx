'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone } from 'lucide-react';
import { validateMobileNumber } from '@/lib/phoneValidation';

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
  onSubmit: (e: React.FormEvent) => void;
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
  onSubmit,
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
            className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-[#ECEEF2] mx-2 sm:mx-4 max-h-[90dvh] overflow-y-auto"
          >
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
