'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Trash2,
  Printer,
  Calendar,
  History,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  FileText,
  Download,
  Eye,
} from 'lucide-react';
import { Patient, InventoryItem, PrescriptionItem } from '@/types';
import { MedicineSearchCombobox } from '@/components/common/MedicineSearchCombobox';
import { formatPatientToken } from '@/lib/utils';
import {
  enterpriseCLMSService,
  PatientMedicalHistoryProfile,
  PatientVisitHistoryItem,
} from '@/lib/enterpriseCLMSService';
import { useClinic } from '@/context/ClinicContext';
import { downloadCustomPrescriptionPdf } from '@/lib/rxPdfGenerator';
import { getAppConfigLocal } from '@/lib/supabaseService';
import { DEFAULT_RX_TEMPLATE_FIELDS, RxTemplateFields } from '@/data/default-config';
import type { PrescriptionPrintRecord } from '@/components/modals/PrescriptionPrintModal';
import { supabase } from '@/lib/supabaseClient';

interface ConsultationViewProps {
  activePatient: Patient | null;
  clinicId?: string;
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
  onViewRxModal?: (record: PrescriptionPrintRecord) => void;
  onGoToQueue: () => void;
}

export function ConsultationView({
  activePatient,
  clinicId,
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
  onViewRxModal,
  onGoToQueue,
}: ConsultationViewProps) {
  const { config } = useClinic();
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
        .fetchPatientMedicalProfile(patientDbId, clinicId)
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
  }, [activePatient, clinicId]);

  const formatVisitDate = (val?: string) => {
    if (!val) return '';
    if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(val.trim())) return val;
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) return val;
    return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const setQuickFollowUp = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setNextVisitDate(ymd);
  };

  const handleOpenPrescriptionPdf = async (fileOrUrl?: string | null, suggestedName?: string) => {
    if (!fileOrUrl) return;
    let resolvedUrl = fileOrUrl;
    if (!/^https?:\/\//i.test(fileOrUrl)) {
      const cleanPath = fileOrUrl.replace(/^prescriptions\//i, '');
      const { data: signed } = await supabase.storage
        .from('prescriptions')
        .createSignedUrl(cleanPath, 300);
      if (signed?.signedUrl) {
        resolvedUrl = signed.signedUrl;
      } else {
        const { data: pub } = supabase.storage.from('prescriptions').getPublicUrl(cleanPath);
        if (pub?.publicUrl) resolvedUrl = pub.publicUrl;
      }
    }

    try {
      const resp = await fetch(resolvedUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = suggestedName || 'Prescription.pdf';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
        return;
      }
    } catch {
      // Fallback to opening signed/public URL in new tab
    }
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
  };

  const getCustomTemplateOptions = () => {
    const localCfg = getAppConfigLocal();
    const templateUrl = config?.rx_template_url || localCfg?.rx_template_url || '';
    const printBg = config?.rx_template_print_bg !== false;
    let fields: RxTemplateFields = DEFAULT_RX_TEMPLATE_FIELDS;
    try {
      const raw = config?.rx_template_fields || localCfg?.rx_template_fields;
      if (raw) fields = { ...DEFAULT_RX_TEMPLATE_FIELDS, ...JSON.parse(raw) };
    } catch {}
    return { templateUrl, printBg, fields };
  };

  const buildVisitPrintRecord = (
    visit: PatientVisitHistoryItem
  ): PrescriptionPrintRecord => {
    const pAge = medicalProfile?.patient?.age || activePatient?.age;
    const pGender = medicalProfile?.patient?.gender || activePatient?.gender || 'Male';
    const items: PrescriptionItem[] = (visit.prescriptions || []).map((pItem, idx) => ({
      med: {
        id: pItem.id || `past-${idx}`,
        brand: pItem.medicine_name || 'Prescribed Medicine',
        generic: '',
        stock: pItem.dispensed_quantity || 1,
      },
      qty: pItem.dispensed_quantity || 1,
      dosage: pItem.dosage || undefined,
      instructions: pItem.instructions || undefined,
    }));

    return {
      appointmentId: visit.appointment_id,
      clinicId,
      locationId: activePatient?.locationId,
      patientId: medicalProfile?.patient?.id || activePatient?.patientDbId,
      date: visit.visit_date || formatVisitDate(visit.date) || 'Visit Date',
      patientName: medicalProfile?.patient?.full_name || activePatient?.name || 'Patient',
      patientPhone: medicalProfile?.patient?.phone || activePatient?.phone,
      demographics: `${pAge || ''} Yrs / ${pGender}`.trim(),
      patientAge: pAge,
      patientGender: pGender,
      tokenNumber: visit.token_number || '',
      diagnostics: visit.clinical_notes || 'Routine consultation',
      items,
      nextVisitDate: visit.next_visit_date,
      branchName: visit.branch_name || config?.branch_name,
      doctorName: visit.doctor_name || 'Consultant Physician',
      doctorTitle: visit.specialization || 'General Medicine',
      prescriptionPdfUrl: visit.prescription_pdf_url,
    };
  };

  const handleDownloadVisitRxPdf = async (visit: PatientVisitHistoryItem) => {
    if (visit.prescription_pdf_url) {
      const safeName = `Rx_${(activePatient?.name || 'Patient').replace(/\s+/g, '_')}_${(visit.visit_date || 'Visit').replace(/\s+/g, '_')}.pdf`;
      await handleOpenPrescriptionPdf(visit.prescription_pdf_url, safeName);
      return;
    }

    const meds = (visit.prescriptions || []).map((p) => ({
      medicineName: p.medicine_name,
      dispensedQuantity: p.dispensed_quantity,
      dosage: p.dosage,
      instructions: p.instructions,
    }));

    const { templateUrl, printBg, fields } = getCustomTemplateOptions();

    await downloadCustomPrescriptionPdf({
      templateUrl,
      printBg,
      fields,
      payload: {
        clinicName: visit.clinic_name || config?.clinic_name || 'HealthSync Clinic',
        branchName: visit.branch_name || config?.branch_name,
        clinicAddress: config?.branch_address || config?.clinic_address,
        clinicPhone: config?.branch_phone || config?.clinic_phone,
        footerText: config?.rx_footer_text,
        patientName: medicalProfile?.patient?.full_name || activePatient?.name || 'Patient',
        patientDisplayId: medicalProfile?.patient?.display_id,
        patientAge: medicalProfile?.patient?.age || activePatient?.age,
        patientGender: medicalProfile?.patient?.gender || activePatient?.gender,
        patientPhone: medicalProfile?.patient?.phone || activePatient?.phone,
        bloodGroup: medicalProfile?.patient?.blood_group,
        visitDate: visit.visit_date || formatVisitDate(visit.date) || 'Visit Date',
        slotTime: visit.slot_time,
        tokenNumber: visit.token_number,
        doctorName: visit.doctor_name || 'Consultant Physician',
        doctorSpecialization: visit.specialization,
        clinicalNotes: visit.clinical_notes,
        nextVisitDate: visit.next_visit_date,
        medications: meds,
      },
    });
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
        <div className="bg-white rounded-2xl border border-[#ECEEF2] p-10 sm:p-14 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 text-slate-500 flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-5 h-5 stroke-[1.75]" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
            No Active Patient Selected
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1.5 mb-6 leading-relaxed">
            Pick a waiting patient from the Doctor Queue to record clinical notes and write a prescription.
          </p>
          <button
            type="button"
            onClick={onGoToQueue}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] text-slate-700 text-xs font-medium px-6 py-2.5 transition-colors cursor-pointer"
          >
            Go to Queue
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Patient Context Banner Card */}
          <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-7 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Token {medicalProfile?.patient?.display_id ? `P${medicalProfile.patient.display_id}` : formatPatientToken(activePatient)} • Slot {activePatient.time}
                  </span>
                  {medicalProfile?.patient?.is_vip && (
                    <span className="rounded-full bg-amber-50 border border-amber-200/70 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                      VIP
                    </span>
                  )}
                  {medicalProfile?.patient?.blood_group && (
                    <span className="rounded-full bg-rose-50 border border-rose-200/70 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                      Blood: {medicalProfile.patient.blood_group}
                    </span>
                  )}
                  {medicalProfile?.visits && medicalProfile.visits.length > 0 && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                      {medicalProfile.total_past_visits ?? medicalProfile.visits.length} Past Visits
                    </span>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-semibold text-[#16191E] truncate">
                  {activePatient.name}
                </h2>

                <p className="text-xs text-slate-500 flex items-center flex-wrap gap-x-3 gap-y-1">
                  <span>{activePatient.age} Years, {activePatient.gender}</span>
                  {activePatient.phone && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>Phone: {activePatient.phone}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                {medicalProfile && (
                  <button
                    type="button"
                    onClick={() => setShowHistoryPanel((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span>Past Visits ({medicalProfile.visits.length})</span>
                    {showHistoryPanel ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                )}
                {isLoadingProfile && !medicalProfile && (
                  <span className="text-xs text-slate-400 px-2">Loading history...</span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 px-3.5 py-1.5 text-xs font-medium text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  In Consultation
                </span>
              </div>
            </div>
          </div>

          {/* 2. Collapsible Previous  & Prescriptions Card */}
          <AnimatePresence>
            {showHistoryPanel && medicalProfile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-7 shadow-2xs space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <History className="w-4 h-4 text-slate-500" />
                      <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
                        Previous Clinical Visits &amp; Prescriptions
                      </h3>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {medicalProfile.visits.length} {medicalProfile.visits.length === 1 ? 'Visit' : 'Visits'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Member since: {medicalProfile.patient?.member_since || formatVisitDate(medicalProfile.patient?.created_at) || 'Registered'}
                    </span>
                  </div>

                  {((medicalProfile.patient?.allergies && medicalProfile.patient.allergies.length > 0) ||
                    (medicalProfile.patient?.chronic_tags && medicalProfile.patient.chronic_tags.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {medicalProfile.patient?.allergies?.map((allergy, idx) => (
                        <span
                          key={`allergy-${idx}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/70 px-3 py-1 text-xs font-medium"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Allergy: {allergy}
                        </span>
                      ))}
                      {medicalProfile.patient?.chronic_tags?.map((tag, idx) => (
                        <span
                          key={`tag-${idx}`}
                          className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 px-3 py-1 text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {medicalProfile.visits.length === 0 ? (
                    <p className="text-xs text-slate-400 py-5 border-y border-slate-200/80 text-center">
                      No prior clinic visits on record.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80 max-h-72 overflow-y-auto">
                      {medicalProfile.visits.map((v, i) => {
                        const statusLower = (v.status || '').toLowerCase();
                        const isCompleted = statusLower === 'completed';
                        const isInProgress = statusLower === 'in progress' || statusLower === 'in-progress';
                        const isCancelled = statusLower === 'cancelled';
                        const hasRxOrNotes =
                          Boolean(v.prescription_pdf_url) ||
                          Boolean(v.prescriptions && v.prescriptions.length > 0) ||
                          isCompleted;
                        const tokenLabel = v.token_number && v.token_number !== '--' ? v.token_number : 'RX';

                        return (
                          <li
                            key={v.appointment_id || i}
                            className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              <span
                                className={`w-11 h-10 rounded-xl flex items-center justify-center text-xs font-medium tabular-nums flex-shrink-0 border ${
                                  isInProgress
                                    ? 'bg-emerald-50 border-emerald-200/80 text-emerald-700'
                                    : isCancelled
                                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                                }`}
                              >
                                {tokenLabel}
                              </span>

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs sm:text-sm font-medium text-[#16191E] whitespace-nowrap">
                                    {v.visit_date || formatVisitDate(v.date)}
                                  </span>
                                  {v.slot_time && (
                                    <span className="text-xs text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
                                      <Clock className="w-3 h-3" />
                                      {v.slot_time}
                                    </span>
                                  )}
                                  {isCompleted && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                                      Completed
                                    </span>
                                  )}
                                  {isInProgress && (
                                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                                      Active Chamber
                                    </span>
                                  )}
                                  {isCancelled && (
                                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-600">
                                      Cancelled
                                    </span>
                                  )}
                                  {v.next_visit_date && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-500 whitespace-nowrap">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      Follow-up: {v.next_visit_date}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                                  <span className="font-medium text-slate-700">{v.doctor_name}</span>
                                  {v.branch_name && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <span className="truncate">{v.branch_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 flex-shrink-0 pl-14 sm:pl-0">
                              {hasRxOrNotes ? (
                                <>
                                  {onViewRxModal && (
                                    <button
                                      type="button"
                                      onClick={() => onViewRxModal(buildVisitPrintRecord(v))}
                                      title="View Custom Prescription"
                                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                                      <span>View Rx</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadVisitRxPdf(v)}
                                    title="Download Prescription PDF"
                                    className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] hover:bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download PDF</span>
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-slate-400 px-2">
                                  {isInProgress ? 'Consultation in progress' : 'No Rx issued'}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {medicalProfile.prescription_pdfs && medicalProfile.prescription_pdfs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        Saved PDFs:
                      </span>
                      {medicalProfile.prescription_pdfs.map((pdf, idx) => (
                        <button
                          key={pdf.file_name || idx}
                          type="button"
                          onClick={() => handleOpenPrescriptionPdf(pdf.file_name)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span>{pdf.visit_date || 'Rx PDF'}</span>
                          {pdf.doctor_name && <span className="text-slate-400">• {pdf.doctor_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3. Step 01: Clinical Notes */}
          <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-7 shadow-2xs space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-xs font-medium text-slate-400 tabular-nums pt-1">01</span>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
                  Clinical Notes &amp; Diagnosis
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Write patient symptoms, examination findings, and diagnosis.
                </p>
              </div>
            </div>

            <textarea
              rows={4}
              value={diagnosticNotes}
              onChange={(e) => setDiagnosticNotes(e.target.value)}
              placeholder="Example: Fever for 2 days, mild cough. Diagnosed with viral URI..."
              className="w-full p-4 bg-slate-50/70 focus:bg-white border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition leading-relaxed"
            />
          </div>

          {/* 4. Step 02: Follow-Up Schedule */}
          <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-7 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-xs font-medium text-slate-400 tabular-nums pt-1">02</span>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
                    Next Visit / Follow-Up Date
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Optional return visit date shown on the printed prescription.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="date"
                  value={nextVisitDate}
                  onChange={(e) => setNextVisitDate(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50/70 focus:bg-white border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-400 transition"
                />
                {nextVisitDate && (
                  <button
                    type="button"
                    onClick={() => setNextVisitDate('')}
                    className="rounded-full border border-rose-200/80 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 pt-1">
              <span className="text-xs text-slate-400 mr-1">Quick select:</span>
              <button
                type="button"
                onClick={() => setQuickFollowUp(3)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-colors cursor-pointer"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickFollowUp(7)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-colors cursor-pointer"
              >
                +1 Week
              </button>
              <button
                type="button"
                onClick={() => setQuickFollowUp(14)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-colors cursor-pointer"
              >
                +2 Weeks
              </button>
              <button
                type="button"
                onClick={() => setQuickFollowUp(30)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-colors cursor-pointer"
              >
                +1 Month
              </button>
            </div>
          </div>

          {/* 5. Step 03: Prescription Builder */}
          <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-7 shadow-2xs space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-xs font-medium text-slate-400 tabular-nums pt-1">03</span>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-[#16191E]">
                    Prescription Builder
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Search medicines from inventory, set quantity &amp; dosage, then add to the list below.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 flex-shrink-0">
                {currentPrescription.length} Added
              </span>
            </div>

            {/* Two-row Spacious Entry Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  1. Select Medicine
                </label>
                <MedicineSearchCombobox
                  inventory={inventory}
                  selectedMedId={selectedMedId}
                  onSelectMedId={setSelectedMedId}
                  onSelectAndFocusQty={() => qtyInputRef.current?.focus()}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr_auto] gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    2. Quantity
                  </label>
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
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200/80 rounded-xl text-xs sm:text-sm outline-none focus:border-slate-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    3. Dosage Instructions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1-0-1 after food for 5 days"
                    value={rxDosage}
                    onChange={(e) => setRxDosage?.(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onAddMedicineToRx();
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200/80 rounded-xl text-xs sm:text-sm outline-none focus:border-slate-400 transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={onAddMedicineToRx}
                  className="bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium px-5 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap h-[42px]"
                >
                  + Add Medicine
                </button>
              </div>

              {setRxDosage && (
                <div className="flex items-center flex-wrap gap-2 pt-1 text-xs text-slate-500">
                  <span className="text-xs text-slate-400 mr-0.5">Quick dosage:</span>
                  {['1-0-1', '1-1-1', '1-0-0', '0-0-1 (HS)', 'SOS (As needed)', 'After food', 'Before food'].map(
                    (preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const nextVal = rxDosage ? `${rxDosage} • ${preset}` : preset;
                          setRxDosage(nextVal);
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        +{preset}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Prescribed Medicines List */}
            <div className="pt-2">
              {currentPrescription.length === 0 ? (
                <div className="border-y border-slate-200/80 py-7 text-center">
                  <p className="text-xs text-slate-400">
                    No medicines added yet. Select a medicine above and click &quot;+ Add Medicine&quot;.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                  {currentPrescription.map((item, idx) => (
                    <li
                      key={item.med.id}
                      className="py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <span className="text-xs font-medium text-slate-400 tabular-nums pt-0.5">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <span className="text-sm font-medium text-[#16191E] block truncate">
                            {item.med.brand}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500">
                            {item.med.generic && <span className="truncate">{item.med.generic}</span>}
                            {item.dosage && (
                              <span className="text-[#2563EB] font-medium">
                                • {item.dosage}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 tabular-nums">
                          Qty: {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveRx(idx)}
                          title="Remove medicine"
                          className="p-2 rounded-full text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Complete & Print Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                {currentPrescription.length} {currentPrescription.length === 1 ? 'medicine' : 'medicines'} ready
                {nextVisitDate ? ` • Follow-up scheduled for ${nextVisitDate}` : ''}
              </p>
              <button
                type="button"
                onClick={() => onCompleteConsultation(nextVisitDate)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium px-6 py-3 transition-colors cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4" />
                <span>Complete Consultation &amp; Print Legal Rx</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}

export default ConsultationView;
