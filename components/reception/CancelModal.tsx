'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Patient } from '@/types';
import { formatPatientToken } from '@/lib/utils';

export const CANCELLATION_REASONS = [
  'Patient Requested Cancellation',
  'Patient No-Show / Did Not Arrive',
  'Doctor Unavailable',
  'Duplicate Entry',
  'Other Reason',
] as const;

interface CancelModalProps {
  isOpen: boolean;
  patient: Patient | null;
  onClose: () => void;
  onConfirmCancel: (patientId: string, reason: string) => Promise<void> | void;
}

export function CancelModal({
  isOpen,
  patient,
  onClose,
  onConfirmCancel,
}: CancelModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !patient) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      const finalReason =
        selectedReason === 'Other Reason'
          ? customReason.trim() || 'Other Reason'
          : selectedReason;
      await onConfirmCancel(patient.id, finalReason);
      onClose();
    } catch (err) {
      console.error('Cancellation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tokenDisplay = formatPatientToken(patient);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ duration: 0.18 }}
          className="bg-white rounded-2xl border border-[#ECEEF2] shadow-xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#ECEEF2] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#16191E]">Cancel Appointment</h3>
              <p className="text-xs text-[#8A909D]">
                Cancel appointment for {patient.name} ({tokenDisplay})
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-3.5">
            <p className="text-xs text-[#5E6470]">
              The slot at <strong className="text-[#16191E]">{patient.time}</strong> will be freed for new bookings.
            </p>

            <div>
              <label className="text-xs font-semibold text-[#8A909D] block mb-1.5">
                Reason (Optional)
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none"
              >
                {CANCELLATION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {selectedReason === 'Other Reason' && (
              <input
                type="text"
                placeholder="Enter custom cancellation reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full h-10 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:border-[#2563EB]"
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-gray-50/70 border-t border-[#ECEEF2] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5E6470] hover:bg-gray-100 transition cursor-pointer"
            >
              Keep
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-5 py-2 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Cancelling...' : 'Confirm Cancel'}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CancelModal;
