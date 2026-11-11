'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Stethoscope,
  UserCheck,
  UserX,
  AlertTriangle,
  ArrowRight,
  Clock,
  Check,
} from 'lucide-react';
import { Patient } from '@/types';
import { DbDoctor } from '@/types/database';
import { formatPatientToken } from '@/lib/utils';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

interface ReassignDoctorModalProps {
  isOpen: boolean;
  patient: Patient | null;
  queue: Patient[];
  doctors: DbDoctor[];
  onClose: () => void;
  onConfirmReassign: (params: {
    appointmentId: string;
    newDoctorId: string;
    newDoctorName: string;
    reason: string;
  }) => Promise<void> | void;
  onConfirmBulkReassign?: (params: {
    fromDoctorId: string;
    toDoctorId: string;
    toDoctorName: string;
    reason: string;
  }) => Promise<void> | void;
  isBulkMode?: boolean;
}

const REASSIGN_REASONS = [
  'Doctor on Leave',
  'Doctor Unwell / Sick Leave',
  'Emergency Duty / Hospital Call',
  'Chamber Relocation',
  'Patient Request / Specialist Referral',
];

export function ReassignDoctorModal({
  isOpen,
  patient,
  queue,
  doctors,
  onClose,
  onConfirmReassign,
  onConfirmBulkReassign,
  isBulkMode = false,
}: ReassignDoctorModalProps) {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [bulkFromDoctorId, setBulkFromDoctorId] = useState<string>('');
  const [reason, setReason] = useState<string>(REASSIGN_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeDoctors = useMemo(() => {
    return doctors.filter((d) => d.is_active !== false);
  }, [doctors]);

  useEffect(() => {
    if (activeDoctors.length > 0 && !selectedDoctorId) {
      if (patient?.doctorId) {
        const alt = activeDoctors.find((d) => d.id !== patient.doctorId);
        setSelectedDoctorId(alt ? alt.id : activeDoctors[0].id);
      } else {
        setSelectedDoctorId(activeDoctors[0].id);
      }
    }
  }, [activeDoctors, selectedDoctorId, patient]);

  useEffect(() => {
    if (isBulkMode && activeDoctors.length > 0 && !bulkFromDoctorId) {
      setBulkFromDoctorId(activeDoctors[0].id);
      if (activeDoctors.length > 1) {
        setSelectedDoctorId(activeDoctors[1].id);
      }
    }
  }, [isBulkMode, activeDoctors, bulkFromDoctorId]);

  const bulkPatientsCount = useMemo(() => {
    if (!isBulkMode || !bulkFromDoctorId) return 0;
    return queue.filter(
      (p) => (p.doctorId === bulkFromDoctorId || (!p.doctorId && activeDoctors[0]?.id === bulkFromDoctorId)) &&
        p.status === 'Waiting'
    ).length;
  }, [isBulkMode, bulkFromDoctorId, queue, activeDoctors]);

  if (!isOpen) return null;

  const currentDoctorName = patient?.doctorName ||
    doctors.find((d) => d.id === patient?.doctorId)?.full_name ||
    'Assigned Doctor';

  const handleApply = async () => {
    setErrorMessage(null);
    const finalReason = reason === 'Other' ? (customReason.trim() || 'Doctor on leave') : reason;

    if (isBulkMode) {
      if (!bulkFromDoctorId || !selectedDoctorId) {
        setErrorMessage('Please select both the doctor on leave and the covering doctor.');
        return;
      }
      if (bulkFromDoctorId === selectedDoctorId) {
        setErrorMessage('The covering doctor cannot be the same doctor on leave.');
        return;
      }
      if (!onConfirmBulkReassign) return;

      const toDoc = activeDoctors.find((d) => d.id === selectedDoctorId);
      setIsSubmitting(true);
      try {
        await onConfirmBulkReassign({
          fromDoctorId: bulkFromDoctorId,
          toDoctorId: selectedDoctorId,
          toDoctorName: toDoc?.full_name || 'Covering Physician',
          reason: finalReason,
        });
        onClose();
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to reassign doctor queue.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!patient) return;
      if (!selectedDoctorId) {
        setErrorMessage('Please select a doctor to reassign this patient to.');
        return;
      }
      const toDoc = activeDoctors.find((d) => d.id === selectedDoctorId);

      setIsSubmitting(true);
      try {
        await onConfirmReassign({
          appointmentId: patient.id,
          newDoctorId: selectedDoctorId,
          newDoctorName: toDoc?.full_name || 'Covering Physician',
          reason: finalReason,
        });
        onClose();
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to reassign patient.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden relative max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <EcgActionLoader isLoading={isSubmitting} text="Reassigning patient..." />

          <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                {isBulkMode ? <UserX className="w-4.5 h-4.5" /> : <UserCheck className="w-4.5 h-4.5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {isBulkMode ? 'Doctor On Leave Queue Transfer' : 'Reassign Patient Doctor'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isBulkMode
                    ? 'Transfer full patient queue to an active physician'
                    : `${patient?.name} (${formatPatientToken(patient)}) • Slot: ${patient?.time}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!isBulkMode && (
              <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Currently Assigned
                  </span>
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5 mt-0.5">
                    <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                    <span>{currentDoctorName}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Scheduled Time
                  </span>
                  <span className="font-semibold text-slate-700 text-xs flex items-center gap-1 justify-end mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{patient?.time}</span>
                  </span>
                </div>
              </div>
            )}

            {isBulkMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Doctor on Leave *
                </label>
                <select
                  value={bulkFromDoctorId}
                  onChange={(e) => setBulkFromDoctorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden transition font-medium"
                >
                  {activeDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.full_name} ({doc.specialization || 'General'})
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-800 text-[11px] font-medium flex items-center justify-between">
                  <span>Waiting patients for this doctor today:</span>
                  <strong className="font-bold text-xs">{bulkPatientsCount} Patients</strong>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Reassign Reason
              </label>
              <div className="grid grid-cols-2 gap-2">
                {REASSIGN_REASONS.map((r) => {
                  const isSelected = reason === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{r}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Reassign To Available Doctor *
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-50/70 border border-slate-200/80 rounded-2xl">
                {activeDoctors
                  .filter((d) => (!isBulkMode ? d.id !== patient?.doctorId : d.id !== bulkFromDoctorId))
                  .map((doc) => {
                    const isSelected = selectedDoctorId === doc.id;
                    const initials = doc.full_name
                      .replace(/^dr\.?\s+/i, '')
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                              doc.is_admin_doctor
                                ? 'bg-gradient-to-tl from-amber-500 to-orange-400'
                                : 'bg-gradient-to-tl from-blue-700 to-blue-500'
                            }`}
                          >
                            {initials || 'DR'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate text-xs">
                              {doc.full_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {doc.specialization || 'General Physician'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Quota: {doc.daily_quota || 30}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-relaxed flex items-start gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                {isBulkMode
                  ? 'All selected active appointments will be transitioned to the covering physician’s queue.'
                  : 'The patient will remain in their token queue and will be consulted by the newly assigned physician.'}
              </span>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/40 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isSubmitting || (isBulkMode && bulkPatientsCount === 0)}
              className="px-5 py-2 text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl shadow-sm shadow-blue-500/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{isBulkMode ? `Transfer ${bulkPatientsCount} Patients` : 'Confirm Reassignment'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ReassignDoctorModal;
