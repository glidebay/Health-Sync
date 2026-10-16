'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';

interface DoctorAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinInput: string;
  setPinInput: (val: string) => void;
  pinError: boolean;
  onPinSubmit: () => void;
  title?: string;
  subtitle?: string;
  buttonText?: string;
}

export function DoctorAuthModal({
  isOpen,
  onClose,
  pinInput,
  setPinInput,
  pinError,
  onPinSubmit,
  title = 'Security Verification',
  subtitle = 'Enter your security PIN',
  buttonText = 'Verify PIN',
}: DoctorAuthModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-white rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl border border-[#ECEEF2] text-center mx-2 sm:mx-4 ${
              pinError ? 'animate-shake' : ''
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-5 h-5 text-[#2563EB]" />
            </div>
            <h3 className="text-base font-bold text-[#16191E] mb-1">{title}</h3>
            <p className="text-xs text-[#8A909D] mb-4">{subtitle}</p>

            <input
              type="password"
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onPinSubmit()}
              autoFocus
              className={`w-full p-2.5 text-center text-lg tracking-widest bg-[#F8F9FB] border rounded-xl outline-none mb-3 ${
                pinError ? 'border-red-500' : 'border-[#ECEEF2]'
              }`}
            />

            {pinError && <p className="text-xs text-red-500 font-medium mb-3">Invalid Security PIN</p>}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onPinSubmit}
              className="w-full py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer mb-2"
            >
              {buttonText}
            </motion.button>
            <button
              onClick={onClose}
              className="text-xs text-[#8A909D] hover:text-black transition cursor-pointer p-1"
            >
              Cancel & Return
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default DoctorAuthModal;
