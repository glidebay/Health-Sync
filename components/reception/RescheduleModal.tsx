'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertTriangle } from 'lucide-react';
import { Patient } from '@/types';
import { AVAILABLE_SLOTS } from '@/lib/constants';
import { useClinic } from '@/context/ClinicContext';
import { formatPatientToken } from '@/lib/utils';

export type ReallocateStrategy =
  | 'patient_late'
  | 'doctor_delay'
  | 'emergency_shift'
  | 'custom_slot';

interface RescheduleModalProps {
  isOpen: boolean;
  patient: Patient | null;
  queue: Patient[];
  onClose: () => void;
  onReschedulePatient: (params: {
    patientId: string;
    strategy: ReallocateStrategy;
    newSlotTime: string;
    newDate?: string;
    reason: string;
    swapWithPatientId?: string;
    delayMinutes?: number;
    cascadeAll?: boolean;
    setUrgentPriority?: boolean;
  }) => Promise<void> | void;
}

const DELAY_PRESETS = [15, 20, 30, 45, 60];

export function RescheduleModal({
  isOpen,
  patient,
  queue,
  onClose,
  onReschedulePatient,
}: RescheduleModalProps) {
  const { config } = useClinic();
  const [strategy, setStrategy] = useState<ReallocateStrategy>('patient_late');
  const [delayMinutes, setDelayMinutes] = useState<number>(20);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('');
  const [customPickerMode, setCustomPickerMode] = useState<'grid' | 'standard'>('grid');
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customTime, setCustomTime] = useState('10:00');
  const [fastTrackReadyPatient, setFastTrackReadyPatient] = useState<boolean>(true);
  const [readyPatientId, setReadyPatientId] = useState<string>('');
  const [cascadeDoctorDelay, setCascadeDoctorDelay] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (config?.use_standard_date_picker !== undefined) {
      setCustomPickerMode(config.use_standard_date_picker ? 'standard' : 'grid');
    }
  }, [config?.use_standard_date_picker]);

  const otherWaitingPatients = useMemo(() => {
    if (!patient) return [];
    return queue.filter((p) => p.id !== patient.id && p.status === 'Waiting');
  }, [queue, patient]);

  useEffect(() => {
    if (otherWaitingPatients.length > 0 && !readyPatientId) {
      setReadyPatientId(otherWaitingPatients[0].id);
    }
  }, [otherWaitingPatients, readyPatientId]);

  useEffect(() => {
    if (patient) {
      setSelectedSlotTime(patient.time || '10:00 AM');
    }
  }, [patient]);

  if (!isOpen || !patient) return null;

  const calculateShiftedTime = (baseTimeStr: string, minutes: number) => {
    try {
      const now = new Date();
      const match = baseTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let hour = parseInt(match[1], 10);
        const min = parseInt(match[2], 10);
        const meridiem = match[3].toUpperCase();
        if (meridiem === 'PM' && hour < 12) hour += 12;
        if (meridiem === 'AM' && hour === 12) hour = 0;
        now.setHours(hour, min, 0, 0);
      }
      const shifted = new Date(now.getTime() + minutes * 60000);
      return shifted.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return baseTimeStr;
    }
  };

  const calculatedNewTime = calculateShiftedTime(patient.time, delayMinutes);

  const handleApply = async () => {
    try {
      setModalError(null);
      setIsSubmitting(true);
      let targetNewTime = patient.time;
      let finalReason = '';

      if (strategy === 'patient_late') {
        targetNewTime = calculatedNewTime;
        finalReason = `Patient running late (+${delayMinutes}m delay)`;
      } else if (strategy === 'doctor_delay') {
        targetNewTime = calculatedNewTime;
        finalReason = `Doctor delay (+${delayMinutes}m)`;
      } else if (strategy === 'emergency_shift') {
        targetNewTime = patient.time;
        finalReason = 'Emergency Priority Shift';
      } else if (strategy === 'custom_slot') {
        targetNewTime = selectedSlotTime || patient.time;
        finalReason = `Reallocated to ${targetNewTime}`;
      }

      await onReschedulePatient({
        patientId: patient.id,
        strategy,
        newSlotTime: targetNewTime,
        newDate: strategy === 'custom_slot' && customPickerMode === 'standard' ? customDate : undefined,
        reason: finalReason,
        swapWithPatientId:
          strategy === 'patient_late' && fastTrackReadyPatient ? readyPatientId : undefined,
        delayMinutes,
        cascadeAll: strategy === 'doctor_delay' ? cascadeDoctorDelay : false,
        setUrgentPriority: strategy === 'emergency_shift',
      });

      onClose();
    } catch (err: any) {
      console.error('Error applying reschedule:', err);
      setModalError(err?.message || 'Failed to reschedule. Please choose an open slot.');
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
          className="bg-white rounded-2xl border border-[#ECEEF2] shadow-xl max-w-lg w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Clean Header */}
          <div className="px-5 py-4 border-b border-[#ECEEF2] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#16191E]">Reschedule Appointment</h3>
              <p className="text-xs text-[#8A909D]">
                {patient.name} ({tokenDisplay}) • Current Slot: {patient.time}
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

          {/* Clean Body */}
          <div className="p-5 space-y-4">
            {/* Error Banner */}
            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Reason Selector Tabs */}
            <div>
              <label className="text-xs font-semibold text-[#8A909D] block mb-1.5">
                Reschedule Reason
              </label>
              <div className="grid grid-cols-4 gap-1.5 bg-[#F8F9FB] p-1 rounded-xl border border-[#ECEEF2]">
                {[
                  { id: 'patient_late', label: 'Patient Late' },
                  { id: 'doctor_delay', label: 'Doctor Delay' },
                  { id: 'emergency_shift', label: 'Emergency' },
                  { id: 'custom_slot', label: 'New Slot' },
                ].map((item) => {
                  const isSelected = strategy === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStrategy(item.id as ReallocateStrategy)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-white text-[#2563EB] shadow-xs'
                          : 'text-[#5E6470] hover:text-[#16191E]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Delay Presets for Patient Late & Doctor Delay */}
            {(strategy === 'patient_late' || strategy === 'doctor_delay') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8A909D]">Delay Amount</span>
                  <span className="text-xs font-bold text-[#2563EB]">
                    New Time: {calculatedNewTime}
                  </span>
                </div>
                <div className="flex gap-2">
                  {DELAY_PRESETS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDelayMinutes(mins)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        delayMinutes === mins
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : 'bg-white border-[#ECEEF2] text-[#5E6470] hover:border-gray-300'
                      }`}
                    >
                      +{mins}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* If Patient is Late: Fast-track ready patient toggle */}
            {strategy === 'patient_late' && otherWaitingPatients.length > 0 && (
              <div className="bg-[#F8F9FB] rounded-xl p-3 border border-[#ECEEF2] space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fastTrackReadyPatient}
                    onChange={(e) => setFastTrackReadyPatient(e.target.checked)}
                    className="w-4 h-4 text-[#2563EB] rounded border-gray-300"
                  />
                  <span className="text-xs font-semibold text-[#16191E]">
                    Move next waiting patient to {patient.time} to consult doctor now
                  </span>
                </label>

                {fastTrackReadyPatient && (
                  <select
                    value={readyPatientId}
                    onChange={(e) => setReadyPatientId(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-[#ECEEF2] rounded-lg text-xs text-[#16191E] outline-none"
                  >
                    {otherWaitingPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatPatientToken(p)}) — Scheduled {p.time}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-[#8A909D]">
                  The vacated slot will be freed up for new bookings.
                </p>
              </div>
            )}

            {/* If Doctor Delay: Cascade toggle */}
            {strategy === 'doctor_delay' && (
              <div className="bg-[#F8F9FB] rounded-xl p-3 border border-[#ECEEF2]">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cascadeDoctorDelay}
                    onChange={(e) => setCascadeDoctorDelay(e.target.checked)}
                    className="w-4 h-4 text-[#2563EB] rounded border-gray-300"
                  />
                  <span className="text-xs font-semibold text-[#16191E]">
                    Shift all remaining waiting patients by +{delayMinutes} minutes
                  </span>
                </label>
              </div>
            )}

            {/* If Emergency: Clean notice */}
            {strategy === 'emergency_shift' && (
              <div className="bg-red-50/60 rounded-xl p-3.5 border border-red-200 text-xs text-red-800">
                Marks <strong>{patient.name}</strong> as Urgent Priority and moves them to the front of the queue to consult doctor next.
              </div>
            )}

            {/* If Custom Slot */}
            {strategy === 'custom_slot' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8A909D]">
                    Choose New Slot
                  </span>
                  <div className="flex items-center space-x-1 bg-[#F8F9FB] p-0.5 rounded-lg border border-[#ECEEF2]">
                    <button
                      type="button"
                      onClick={() => setCustomPickerMode('grid')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                        customPickerMode === 'grid'
                          ? 'bg-white text-[#2563EB] shadow-2xs'
                          : 'text-[#8A909D] hover:text-[#16191E]'
                      }`}
                    >
                      Time Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomPickerMode('standard')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                        customPickerMode === 'standard'
                          ? 'bg-white text-[#2563EB] shadow-2xs'
                          : 'text-[#8A909D] hover:text-[#16191E]'
                      }`}
                    >
                      Date Picker
                    </button>
                  </div>
                </div>

                {customPickerMode === 'standard' ? (
                  <div className="grid grid-cols-2 gap-2 bg-[#F8F9FB] p-3 rounded-xl border border-[#ECEEF2]">
                    <div>
                      <span className="text-[10px] font-semibold text-[#8A909D] block mb-1">Date</span>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full h-9 px-2.5 bg-white border border-[#ECEEF2] rounded-lg text-xs font-semibold text-[#16191E] outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-[#8A909D] block mb-1">Time</span>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => {
                          setCustomTime(e.target.value);
                          setSelectedSlotTime(calculateShiftedTime(e.target.value, 0));
                        }}
                        className="w-full h-9 px-2.5 bg-white border border-[#ECEEF2] rounded-lg text-xs font-semibold text-[#16191E] outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-[#F8F9FB] rounded-xl border border-[#ECEEF2]">
                    {AVAILABLE_SLOTS.map((slot) => {
                      const isSelected = selectedSlotTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedSlotTime(slot.time)}
                          className={`py-1.5 px-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#2563EB] text-white border-[#2563EB]'
                              : 'bg-white border-[#ECEEF2] text-[#16191E] hover:border-blue-200'
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clean Footer */}
          <div className="px-5 py-3.5 bg-gray-50/70 border-t border-[#ECEEF2] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5E6470] hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleApply}
              disabled={isSubmitting}
              className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Confirm Reschedule'}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default RescheduleModal;
