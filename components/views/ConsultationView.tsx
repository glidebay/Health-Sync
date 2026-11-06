'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Phone,
  Trash2,
  Printer,
  Calendar,
  History,
  Pill,
  ChevronDown,
  ChevronUp,
  Clock,
  CalendarPlus,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Patient, InventoryItem, PrescriptionItem } from '@/types';
import { MedicineSearchCombobox } from '@/components/common/MedicineSearchCombobox';
import { formatPatientToken } from '@/lib/utils';
import {
  enterpriseCLMSService,
  PatientMedicalHistoryProfile,
} from '@/lib/enterpriseCLMSService';

interface ConsultationViewProps {
  activePatient: Patient | null;
  diagnosticNotes: string;
  setDiagnosticNotes: (v: string) => void;
  selectedMedId: string;
  setSelectedMedId: (v: string) => void;
  rxQty: string;
  setRxQty: (v: string) => void;
  rxDosage?: string;
  setRxDosage?: (v: string) => void;
  inventory: InventoryItem[];
  currentPrescription: PrescriptionItem[];
  onAddMedicineToRx: () => void;
  onRemoveRx: (index: number) => void;
  onCompleteConsultation: (nextVisitDate?: string) => void;
  onGoToQueue: () => void;
}

export function ConsultationView({
  activePatient,
  diagnosticNotes,
  setDiagnosticNotes,
  selectedMedId,
  setSelectedMedId,
  rxQty,
  setRxQty,
  rxDosage = '',
  setRxDosage,
  inventory,
  currentPrescription,
  onAddMedicineToRx,
  onRemoveRx,
  onCompleteConsultation,
  onGoToQueue,
}: ConsultationViewProps) {
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [nextVisitDate, setNextVisitDate] = useState<string>('');

  const [medicalProfile, setMedicalProfile] = useState<PatientMedicalHistoryProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(false);

  useEffect(() => {
    if (!activePatient) {
      setMedicalProfile(null);
      setNextVisitDate('');
      setShowHistoryPanel(false);
      return;
    }

    const patientDbId = activePatient.patientDbId || activePatient.id;
    if (patientDbId) {
      setIsLoadingProfile(true);
      enterpriseCLMSService
        .fetchPatientMedicalProfile(patientDbId)
        .then((profile) => {
          if (profile && profile.success) {
            setMedicalProfile(profile);
            if (profile.visits && profile.visits.length > 0) {
              setShowHistoryPanel(true);
            }
          }
        })
        .catch((err) => console.warn('Could not load patient medical history:', err))
        .finally(() => setIsLoadingProfile(false));
    }
  }, [activePatient]);

  const setQuickFollowUp = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setNextVisitDate(ymd);
  };

  return (
    <motion.section
      key="consult"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      {!activePatient ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-[#ECEEF2] shadow-sm">
          <Stethoscope className="w-12 h-12 text-[#2563EB] opacity-40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#16191E]">No Active Patient Selected</h3>
          <p className="text-xs text-[#8A909D] max-w-sm mx-auto mt-1 mb-5">
            Select a patient from the Doctor Queue to open diagnostic notes & prescription builder
          </p>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onGoToQueue}
            className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-6 py-2.5 rounded-xl transition cursor-pointer"
          >
            Go to Queue
          </motion.button>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-[#16191E]">{activePatient.name}</h2>
                <span className="text-xs text-[#8A909D] font-semibold">
                  ({formatPatientToken(activePatient)})
                </span>
                {medicalProfile?.visits && medicalProfile.visits.length > 0 && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {medicalProfile.visits.length} Past Visits
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8A909D] font-medium mt-0.5 flex items-center flex-wrap gap-1.5">
                <span>{activePatient.age} Yrs • {activePatient.gender}</span>
                {activePatient.phone && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-[#16191E]">
                      <Phone className="w-3 h-3 text-[#2563EB]" />
                      {activePatient.phone}
                    </span>
                  </>
                )}
                <span>• Slot: {activePatient.time}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {medicalProfile && (
                <button
                  type="button"
                  onClick={() => setShowHistoryPanel((prev) => !prev)}
                  className="text-xs font-bold px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Medical History ({medicalProfile.visits.length})</span>
                  {showHistoryPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
              <span className="text-xs font-bold bg-[#EBECEF] text-[#16191E] px-3.5 py-1.5 rounded-xl">
                Active Chamber
              </span>
            </div>
          </div>

          <AnimatePresence>
            {showHistoryPanel && medicalProfile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-gradient-to-br from-blue-50/60 to-slate-50 rounded-2xl p-4 sm:p-6 border border-blue-100 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <History className="w-4 h-4 text-blue-600" />
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        Patient Longitudinal Medical History & Past Rx
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Registered: {new Date(medicalProfile.patient?.created_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        Previous Clinical Visits ({medicalProfile.visits.length})
                      </span>
                      {medicalProfile.visits.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">No prior clinic visits on record.</p>
                      ) : (
                        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                          {medicalProfile.visits.map((v, i) => (
                            <div key={v.appointment_id || i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                              <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                                <span>{new Date(v.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <span className="text-blue-600">{v.doctor_name}</span>
                              </div>
                              <p className="text-slate-600 mt-1 line-clamp-2">{v.clinical_notes || 'Routine consultation'}</p>
                              {v.next_visit_date && (
                                <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                                  Follow-up set for: {v.next_visit_date}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
                        <Pill className="w-3.5 h-3.5 text-indigo-600" />
                        Past Prescribed Medications ({medicalProfile.prescriptions.length})
                      </span>
                      {medicalProfile.prescriptions.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">No prior medications recorded.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {medicalProfile.prescriptions.map((rx, i) => (
                            <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs flex justify-between items-center">
                              <div>
                                <span className="font-bold text-slate-800 block">{rx.medicine_name}</span>
                                <span className="text-[11px] text-blue-600">{rx.dosage || rx.instructions || 'Standard dosage'}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {new Date(rx.prescribed_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm">
            <h3 className="text-sm font-bold text-[#16191E] mb-3">Clinical Diagnostic Notes</h3>
            <textarea
              rows={3}
              value={diagnosticNotes}
              onChange={(e) => setDiagnosticNotes(e.target.value)}
              placeholder="Record patient complaints, clinical findings, symptoms, and diagnosis..."
              className="w-full p-3.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-gray-300 transition"
            />
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#16191E] flex items-center gap-1.5">
                  <CalendarPlus className="w-4 h-4 text-blue-600" />
                  Next-Visit Follow-Up Charting
                </h3>
                <p className="text-xs text-[#8A909D] mt-0.5">
                  Schedule patient return visit date for automatic reminders and legal prescription print
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={nextVisitDate}
                  onChange={(e) => setNextVisitDate(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
                />
                {nextVisitDate && (
                  <button
                    type="button"
                    onClick={() => setNextVisitDate('')}
                    className="text-[11px] font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => setQuickFollowUp(3)}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border border-gray-200/60 font-semibold text-slate-600 transition cursor-pointer"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickFollowUp(7)}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border border-gray-200/60 font-semibold text-slate-600 transition cursor-pointer"
              >
                +1 Week
              </button>
              <button
                type="button"
                onClick={() => setQuickFollowUp(14)}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border border-gray-200/60 font-semibold text-slate-600 transition cursor-pointer"
              >
                +2 Weeks
              </button>
              <button
                type="button"
                onClick={() => setQuickFollowUp(30)}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 border border-gray-200/60 font-semibold text-slate-600 transition cursor-pointer"
              >
                +1 Month
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
              <h3 className="text-sm font-bold text-[#16191E]">
                Prescription Builder
              </h3>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <MedicineSearchCombobox
                  inventory={inventory}
                  selectedMedId={selectedMedId}
                  onSelectMedId={setSelectedMedId}
                  onSelectAndFocusQty={() => qtyInputRef.current?.focus()}
                />

                <div className="flex gap-2">
                  <input
                    ref={qtyInputRef}
                    type="number"
                    placeholder="Qty"
                    min="1"
                    value={rxQty}
                    onChange={(e) => setRxQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onAddMedicineToRx();
                      }
                    }}
                    className="w-20 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-gray-300"
                  />

                  <input
                    type="text"
                    placeholder="Dosage (e.g. 1-0-1 after food)"
                    value={rxDosage}
                    onChange={(e) => setRxDosage?.(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onAddMedicineToRx();
                      }
                    }}
                    className="flex-1 min-w-[140px] p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm outline-none focus:ring-1 focus:ring-gray-300"
                  />

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={onAddMedicineToRx}
                    className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                  >
                    Add to Rx
                  </motion.button>
                </div>
              </div>

              {setRxDosage && (
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px] text-[#5E6470]">
                  <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider mr-1">Presets:</span>
                  {['1-0-1', '1-1-1', '1-0-0', '0-0-1 (HS)', 'SOS (As needed)', 'After food', 'Before food'].map(
                    (preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const nextVal = rxDosage ? `${rxDosage} • ${preset}` : preset;
                          setRxDosage(nextVal);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-[#2563EB] border border-gray-200/60 font-medium transition cursor-pointer flex-shrink-0"
                      >
                        +{preset}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="border border-[#ECEEF2] rounded-xl p-3 sm:p-4 bg-[#F8F9FB] min-h-[100px]">
              {currentPrescription.length === 0 ? (
                <p className="text-xs text-[#8A909D] italic text-center py-4">
                  No medicines prescribed yet. Search and select a medicine from above.
                </p>
              ) : (
                <div className="space-y-2">
                  {currentPrescription.map((item, idx) => (
                    <div
                      key={item.med.id}
                      className="bg-white p-3 rounded-xl border border-[#ECEEF2] flex justify-between items-center gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-sm text-[#16191E] block truncate">{item.med.brand}</span>
                        <span className="text-[10px] text-[#8A909D] block truncate">{item.med.generic}</span>
                        {item.dosage && (
                          <span className="text-[11px] text-[#2563EB] font-medium block truncate mt-0.5">
                            • {item.dosage}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                        <span className="text-xs font-bold bg-[#F4F5F7] px-2.5 py-1 rounded-lg">
                          Qty: {item.qty}
                        </span>
                        <button
                          onClick={() => onRemoveRx(idx)}
                          className="text-red-500 hover:text-red-700 cursor-pointer p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onCompleteConsultation(nextVisitDate)}
              className="w-full mt-6 py-3.5 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Complete Consultation & Print Legal Rx</span>
            </motion.button>
          </div>
        </div>
      )}
    </motion.section>
  );
}

export default ConsultationView;
