'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  X,
  Printer,
  Copy,
  Check,
  ShieldAlert,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { Patient } from '@/types';
import { formatPatientToken } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb, fetchBranchVisitLogDb } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import { NumberedPagination } from '@/components/ui/pagination';
import { EcgActionLoader } from '@/components/loading/EcgActionLoader';

function getTodayIST(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

function formatDisplayDate(dateStr: string, todayIST: string): string {
  try {
    if (dateStr === todayIST) return 'Today';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function shiftDate(dateStr: string, days: number): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return new Intl.DateTimeFormat('en-CA').format(date);
  } catch {
    return dateStr;
  }
}

export interface VisitLogPrescriptionDetail {
  brandName: string;
  genericName: string;
  qty: number;
  dosage?: string;
}

export interface VisitLogPatientDetailsPayload {
  clinicalNotes?: string;
  prescriptions?: VisitLogPrescriptionDetail[];
  doctorName?: string;
  doctorSpecialization?: string;
  nextVisitDate?: string;
  prescriptionPdfUrl?: string;
}

interface TablesViewProps {
  initialQueue?: Patient[];
  onOpenConsultation?: (patientId: string) => void;
  onPrintRecord?: (patient: Patient, details?: VisitLogPatientDetailsPayload) => void;
  locationId?: string;
  clinicId?: string;
  branchName?: string;
}

export function TablesView({
  initialQueue = [],
  onOpenConsultation,
  onPrintRecord,
  locationId,
  clinicId,
  branchName,
}: TablesViewProps) {
  const todayIST = useMemo(() => getTodayIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [visitTab, setVisitTab] = useState<'completed' | 'cancelled'>('completed');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  const [selectedPatientForDetails, setSelectedPatientForDetails] = useState<Patient | null>(null);
  const [patientDetailsRecord, setPatientDetailsRecord] = useState<VisitLogPatientDetailsPayload | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [hasCopiedPhone, setHasCopiedPhone] = useState<boolean>(false);

  const loadData = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const queryDate = selectedDate === 'ALL' ? null : selectedDate;
        const visitLogRes = await fetchBranchVisitLogDb({
          date: queryDate,
          status: 'All',
          locationId,
          clinicId,
          limit: 250,
        });
        if (visitLogRes.success) {
          setDbPatients(visitLogRes.visits);
        } else {
          const fetched = await fetchPatientAppointmentsFromDb({
            date: queryDate || undefined,
            status: 'All',
            locationId,
            clinicId,
          });
          setDbPatients(fetched);
        }
      } catch (err) {
        console.warn('TablesView fetch error:', err);
      } finally {
        if (!silent) setIsLoading(false);
        else setIsRefreshing(false);
      }
    },
    [selectedDate, locationId, clinicId]
  );

  useEffect(() => {
    setCurrentPage(1);
    loadData();

    const handleSync = () => {
      loadData(true);
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData(true);
      }, 300);
    };

    // Supabase Realtime WebSocket subscription (instant updates on appointment logs)
    const channel = supabase
      .channel('realtime-tables-view')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          debouncedLoad();
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const allDatePatients = useMemo(() => {
    if (dbPatients !== null) return dbPatients;
    return initialQueue.filter((p) => {
      if (selectedDate === 'ALL') return true;
      return p.appointmentDate ? p.appointmentDate === selectedDate : true;
    });
  }, [dbPatients, initialQueue, selectedDate]);

  const completedPatients = useMemo(() => {
    return allDatePatients.filter((p) => p.status === 'Completed');
  }, [allDatePatients]);

  const cancelledPatients = useMemo(() => {
    return allDatePatients.filter((p) => p.status === 'Cancelled');
  }, [allDatePatients]);

  const combinedLogPatients = useMemo(() => {
    return visitTab === 'completed' ? completedPatients : cancelledPatients;
  }, [visitTab, completedPatients, cancelledPatients]);

  const totalPages = Math.max(1, Math.ceil(combinedLogPatients.length / itemsPerPage));

  const paginatedLogs = useMemo(() => {
    return combinedLogPatients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [combinedLogPatients, currentPage, itemsPerPage]);

  const fetchFullPatientDetails = useCallback(async (patient: Patient) => {
    setSelectedPatientForDetails(patient);
    setIsLoadingDetails(true);
    setPatientDetailsRecord(null);

    try {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('clinical_notes, next_visit_date, scheduled_time, queue_token_no, doctor:doctors(full_name, specialization)')
        .eq('id', patient.id)
        .maybeSingle();

      let pdfUrl: string | undefined;
      try {
        const { data: pdfRow } = await supabase
          .from('appointments')
          .select('prescription_pdf_url')
          .eq('id', patient.id)
          .maybeSingle();
        if (pdfRow?.prescription_pdf_url) pdfUrl = pdfRow.prescription_pdf_url;
      } catch { }

      const { data: rxRows } = await supabase
        .from('prescribed_medications')
        .select('*')
        .eq('appointment_id', patient.id);

      let mappedPrescriptions: VisitLogPrescriptionDetail[] = [];

      if (rxRows && rxRows.length > 0) {
        const medIds = Array.from(
          new Set(rxRows.map((rx: any) => rx.medicine_id || rx.inventory_id).filter(Boolean))
        );
        const medMap = new Map<string, { brand: string; generic: string; form: string }>();
        if (medIds.length > 0) {
          const { data: medRows } = await supabase
            .from('medicines')
            .select('id, brand_name, generic_name, dosage_form')
            .in('id', medIds);
          (medRows || []).forEach((m: any) => {
            medMap.set(String(m.id), {
              brand: m.brand_name || 'Medicine',
              generic: m.generic_name || '',
              form: m.dosage_form || 'Standard',
            });
          });
        }

        mappedPrescriptions = rxRows.map((rx: any) => {
          const matchedMed = medMap.get(String(rx.medicine_id || rx.inventory_id || ''));
          return {
            brandName: rx.medicine_name || matchedMed?.brand || 'Medicine',
            genericName: matchedMed?.generic || '',
            qty: rx.dispensed_quantity || 1,
            dosage: rx.dosage || matchedMed?.form || 'Standard',
          };
        });
      }

      // Fallback recovery from stock_movements (RX-Pxxx + IST date) if prescribed_medications is empty
      if (mappedPrescriptions.length === 0) {
        const tokenDisplay = formatPatientToken(patient);
        if (tokenDisplay && tokenDisplay !== '--') {
          const { data: movs } = await supabase
            .from('stock_movements')
            .select('id, medicine_id, quantity, date, created_at')
            .ilike('movement_type', 'dispensing')
            .eq('reference_number', `RX-${tokenDisplay.toUpperCase()}`);

          if (movs && movs.length > 0) {
            const visitDateYmd = patient.appointmentDate || (apptData?.scheduled_time
              ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(apptData.scheduled_time))
              : '');
            const dayMovs = movs.filter((m: any) => {
              if (!visitDateYmd) return true;
              const movYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
                new Date(m.date || m.created_at)
              );
              return movYmd === visitDateYmd;
            });

            const medIds = Array.from(new Set(dayMovs.map((m: any) => m.medicine_id).filter(Boolean)));
            const medMap = new Map<string, { brand: string; generic: string; form: string }>();
            if (medIds.length > 0) {
              const { data: meds } = await supabase
                .from('medicines')
                .select('id, brand_name, generic_name, dosage_form')
                .in('id', medIds);
              (meds || []).forEach((m: any) => {
                medMap.set(String(m.id), {
                  brand: m.brand_name || 'Medicine',
                  generic: m.generic_name || '',
                  form: m.dosage_form || 'Standard',
                });
              });
            }

            mappedPrescriptions = dayMovs.map((m: any) => {
              const matched = medMap.get(String(m.medicine_id));
              return {
                brandName: matched?.brand || 'Medicine',
                genericName: matched?.generic || '',
                qty: Math.max(1, Math.abs(Number(m.quantity) || 1)),
                dosage: matched?.form || 'Standard',
              };
            });
          }
        }
      }

      const docObj = Array.isArray((apptData as any)?.doctor)
        ? (apptData as any).doctor[0]
        : (apptData as any)?.doctor;

      setPatientDetailsRecord({
        clinicalNotes: apptData?.clinical_notes || patient.cancellationReason || '',
        prescriptions: mappedPrescriptions,
        doctorName: docObj?.full_name || patient.doctorName || undefined,
        doctorSpecialization: docObj?.specialization || undefined,
        nextVisitDate: apptData?.next_visit_date || undefined,
        prescriptionPdfUrl: pdfUrl,
      });
    } catch (err) {
      console.warn('Error fetching detailed patient telemetry:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const handleCopyPhone = (phone?: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setHasCopiedPhone(true);
    setTimeout(() => setHasCopiedPhone(false), 2000);
  };

  return (
    <motion.div
      key="tables-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-12"
    >
      <EcgActionLoader isLoading={isLoading} fullscreen={true} text="Syncing visit logs..." />

      {/* Editorial Header Card (matches Overall Project UI) */}
      <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-8 shadow-2xs flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
            Visit Archive • {combinedLogPatients.length} {combinedLogPatients.length === 1 ? 'Record' : 'Records'}
          </span>
          <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-semibold text-[#16191E]">
              Visit Logs
            </h2>
            {branchName && (
              <span className="rounded-full border border-blue-200/70 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                {branchName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Completed consultations and cancellation audits for {selectedDate === 'ALL' ? 'All Recent Dates' : formatDisplayDate(selectedDate, todayIST)}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedDate((prev) => (prev === 'ALL' ? todayIST : 'ALL'))}
            className={`px-4 py-2 rounded-full text-xs font-medium transition cursor-pointer border ${selectedDate === 'ALL'
              ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-2xs'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
          >
            {selectedDate === 'ALL' ? 'Showing All Recent' : 'All Recent Logs'}
          </button>

          <div className="relative flex items-center bg-white rounded-xl border border-[#ECEEF2] p-1 shadow-2xs hover:border-slate-300 transition-all">
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate === 'ALL' ? todayIST : selectedDate, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex items-center gap-2 px-2.5 py-0.5 cursor-pointer">
              <Calendar className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-800 select-none whitespace-nowrap">
                {selectedDate === 'ALL' ? 'All Dates' : formatDisplayDate(selectedDate, todayIST)}
              </span>
              <span className="text-[11px] font-normal text-slate-400 select-none whitespace-nowrap">
                {selectedDate === 'ALL' ? 'Recent' : selectedDate}
              </span>
              <input
                type="date"
                value={selectedDate === 'ALL' ? '' : selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Pick a date"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate === 'ALL' ? todayIST : selectedDate, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDate !== todayIST && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayIST)}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Status Filter Pills (Completed & Cancelled) */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setVisitTab('completed');
            setCurrentPage(1);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition cursor-pointer ${visitTab === 'completed'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
        >
          <CheckCircle2 className={`w-3.5 h-3.5 ${visitTab === 'completed' ? 'text-white' : 'text-emerald-600'}`} />
          <span>Completed</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] tabular-nums ${visitTab === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
            {completedPatients.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setVisitTab('cancelled');
            setCurrentPage(1);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition cursor-pointer ${visitTab === 'cancelled'
            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
        >
          <XCircle className={`w-3.5 h-3.5 ${visitTab === 'cancelled' ? 'text-white' : 'text-rose-500'}`} />
          <span>Cancelled</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] tabular-nums ${visitTab === 'cancelled' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'}`}>
            {cancelledPatients.length}
          </span>
        </button>
      </div>

      {/* Full-Width Visit Log Divided List */}
      {paginatedLogs.length === 0 && !isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#ECEEF2] shadow-2xs">
          <div className="w-11 h-11 rounded-full border border-slate-200 bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3.5">
            <ClipboardList className="w-5 h-5 stroke-[1.75]" />
          </div>
          <h4 className="text-sm font-medium text-slate-800">No {visitTab === 'completed' ? 'Completed' : 'Cancelled'} Visits Found</h4>
          <p className="text-xs text-slate-400 mt-1.5">
            No {visitTab} visits recorded for {selectedDate === 'ALL' ? 'recent dates' : formatDisplayDate(selectedDate, todayIST)}.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-8 shadow-2xs">
            <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
              {paginatedLogs.map((patient, index) => {
                const isCompleted = patient.status === 'Completed';
                const tokenDisplay = formatPatientToken(patient);
                const rowNumber = String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0');
                const dateLabel = patient.appointmentDate
                  ? formatDisplayDate(patient.appointmentDate, todayIST)
                  : formatDisplayDate(selectedDate, todayIST);

                return (
                  <li key={patient.id}>
                    <div className="group grid grid-cols-1 gap-4 py-5 sm:py-6 transition-colors sm:grid-cols-[2.75rem_1fr_auto] sm:gap-6 lg:grid-cols-[2.75rem_1fr_1.5fr_auto] lg:gap-10 items-start sm:items-center hover:bg-slate-50/70 -mx-6 sm:-mx-8 px-6 sm:px-8">
                      {/* Index */}
                      <span className="text-xs font-medium text-slate-400 tabular-nums sm:pt-0.5">
                        {rowNumber}
                      </span>

                      {/* Patient Name & Token/Demographics */}
                      <div className="min-w-0 space-y-1.5">
                        <h3 className="text-sm sm:text-base font-semibold text-[#16191E] truncate">
                          {patient.name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                          Token {tokenDisplay} • {patient.age} yrs, {patient.gender}
                          {patient.phone ? ` • ${patient.phone}` : ''}
                        </p>
                      </div>

                      {/* Readable Summary & Metadata Pills */}
                      <div className="sm:col-start-2 lg:col-start-auto min-w-0 space-y-2.5">
                        <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">
                          {isCompleted
                            ? `${patient.visitType || 'Walk-in'} Consultation at ${patient.time}`
                            : (patient.cancellationReason || 'Cancelled upon request')}
                        </p>
                        <ul className="flex flex-wrap gap-2">
                          <li className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-[11px] font-normal text-slate-600">
                            {dateLabel}
                          </li>
                          {patient.doctorName && (
                            <li className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-[11px] font-normal text-slate-600">
                              {patient.doctorName}
                            </li>
                          )}
                          {!isCompleted && (
                            <li className="rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-[11px] font-medium text-rose-600">
                              Cancelled ({patient.time})
                            </li>
                          )}
                          {patient.priority === 'Urgent' && (
                            <li className="rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-[11px] font-medium text-rose-700">
                              Urgent Priority
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Right-aligned View Details Pill Button */}
                      <div className="flex items-center justify-end sm:col-start-3 sm:row-start-1 lg:col-start-4">
                        <button
                          type="button"
                          onClick={() => fetchFullPatientDetails(patient)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white group-hover:border-[#2563EB] cursor-pointer"
                        >
                          <span>View Details</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {combinedLogPatients.length > itemsPerPage && (
            <div className="bg-white rounded-2xl border border-[#ECEEF2] px-5 py-3 shadow-2xs">
              <NumberedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={combinedLogPatients.length}
                itemsPerPage={itemsPerPage}
                itemName="visits"
              />
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedPatientForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative"
            >
              <EcgActionLoader isLoading={isLoadingDetails} text="Fetching clinical record..." />

              {/* Modal Header (matches Walk-in Register & Add Doctor modal) */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 truncate">
                    {selectedPatientForDetails.name}
                  </h3>
                  <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg flex-shrink-0">
                    {formatPatientToken(selectedPatientForDetails)}
                  </span>
                  {selectedPatientForDetails.status === 'Completed' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Cancelled
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPatientForDetails(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Demographics &amp; Slot
                    </label>
                    <div className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/60 text-slate-800 font-medium truncate">
                      {selectedPatientForDetails.age}y, {selectedPatientForDetails.gender} • {selectedPatientForDetails.time}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mobile Number
                    </label>
                    <div className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/60 text-slate-800 font-medium flex items-center justify-between gap-1">
                      <span className="truncate">{selectedPatientForDetails.phone || 'None'}</span>
                      {selectedPatientForDetails.phone && (
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(selectedPatientForDetails.phone)}
                          className="text-slate-400 hover:text-[#2563EB] flex-shrink-0 cursor-pointer"
                          title="Copy phone"
                        >
                          {hasCopiedPhone ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Channel &amp; Priority
                    </label>
                    <div className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/60 text-slate-800 font-medium truncate">
                      {selectedPatientForDetails.visitType || 'Walk-in'} • {selectedPatientForDetails.priority || 'Normal'}
                    </div>
                  </div>
                </div>

                {selectedPatientForDetails.status === 'Cancelled' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cancellation Reason
                    </label>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        {selectedPatientForDetails.cancellationReason || 'Appointment cancelled upon patient or clinic staff triage request.'}
                      </span>
                    </div>
                  </div>
                )}

                {selectedPatientForDetails.status === 'Completed' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Consultation Notes &amp; Diagnostics
                      </label>
                      <div className="px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 min-h-[54px] whitespace-pre-wrap leading-relaxed">
                        {patientDetailsRecord?.clinicalNotes || (
                          <span className="text-slate-400 italic">
                            Patient consultation completed and verified in chamber.
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Prescribed Medicines
                      </label>
                      {patientDetailsRecord?.prescriptions && patientDetailsRecord.prescriptions.length > 0 ? (
                        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                          {patientDetailsRecord.prescriptions.map((rx, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-slate-800 block truncate">
                                  {rx.brandName}
                                </span>
                                {rx.genericName && (
                                  <span className="text-[11px] text-slate-400 block truncate">
                                    {rx.genericName}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg flex-shrink-0">
                                {rx.qty} units
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50/60 text-slate-400 italic">
                          Standard clinical advice given. No external pharmacy items billed.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2.5">
                {selectedPatientForDetails.phone ? (
                  <a
                    href={`https://wa.me/${selectedPatientForDetails.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  {selectedPatientForDetails.status === 'Completed' && onPrintRecord && (
                    <button
                      type="button"
                      onClick={() => {
                        onPrintRecord(selectedPatientForDetails, patientDetailsRecord || undefined);
                        setSelectedPatientForDetails(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>View / Print Rx</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPatientForDetails(null)}
                    className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default TablesView;
