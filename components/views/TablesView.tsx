'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Phone,
  MessageSquare,
  Clock,
  X,
  Stethoscope,
  Pill,
  ArrowRight,
  Printer,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { Patient } from '@/types';
import { formatPatientToken } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb } from '@/lib/supabaseService';
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

function getInitials(name: string): string {
  if (!name) return 'PT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface TablesViewProps {
  initialQueue?: Patient[];
  onOpenConsultation?: (patientId: string) => void;
  onPrintRecord?: (patient: Patient) => void;
}

export function TablesView({
  initialQueue = [],
  onOpenConsultation,
  onPrintRecord,
}: TablesViewProps) {
  const todayIST = useMemo(() => getTodayIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [completedPage, setCompletedPage] = useState<number>(1);
  const [cancelledPage, setCancelledPage] = useState<number>(1);
  const itemsPerPage = 6;

  const [selectedPatientForDetails, setSelectedPatientForDetails] = useState<Patient | null>(null);
  const [patientDetailsRecord, setPatientDetailsRecord] = useState<{
    clinicalNotes?: string;
    prescriptions?: Array<{ brandName: string; genericName: string; qty: number; dosage?: string }>;
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [hasCopiedPhone, setHasCopiedPhone] = useState<boolean>(false);

  const loadData = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const fetched = await fetchPatientAppointmentsFromDb({
          date: selectedDate,
          status: 'All',
        });
        setDbPatients(fetched);
      } catch (err) {
        console.warn('TablesView fetch error:', err);
      } finally {
        if (!silent) setIsLoading(false);
        else setIsRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    setCompletedPage(1);
    setCancelledPage(1);
    loadData();

    const interval = setInterval(() => {
      loadData(true);
    }, 3000);

    const handleSync = () => {
      loadData(true);
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-tables-view')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          loadData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const allDatePatients = useMemo(() => {
    if (dbPatients !== null) return dbPatients;
    return initialQueue.filter((p) => (p.appointmentDate ? p.appointmentDate === selectedDate : true));
  }, [dbPatients, initialQueue, selectedDate]);

  const completedPatients = useMemo(() => {
    return allDatePatients.filter((p) => p.status === 'Completed');
  }, [allDatePatients]);

  const cancelledPatients = useMemo(() => {
    return allDatePatients.filter((p) => p.status === 'Cancelled');
  }, [allDatePatients]);

  const completedTotalPages = Math.max(1, Math.ceil(completedPatients.length / itemsPerPage));
  const cancelledTotalPages = Math.max(1, Math.ceil(cancelledPatients.length / itemsPerPage));

  const paginatedCompleted = useMemo(() => {
    return completedPatients.slice((completedPage - 1) * itemsPerPage, completedPage * itemsPerPage);
  }, [completedPatients, completedPage, itemsPerPage]);

  const paginatedCancelled = useMemo(() => {
    return cancelledPatients.slice((cancelledPage - 1) * itemsPerPage, cancelledPage * itemsPerPage);
  }, [cancelledPatients, cancelledPage, itemsPerPage]);

  const fetchFullPatientDetails = useCallback(async (patient: Patient) => {
    setSelectedPatientForDetails(patient);
    setIsLoadingDetails(true);
    setPatientDetailsRecord(null);

    try {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('clinical_notes')
        .eq('id', patient.id)
        .maybeSingle();

      const { data: rxData } = await supabase
        .from('prescribed_medications')
        .select('dispensed_quantity, inventory:inventory_id(brand_name, generic_name, dosage_form)')
        .eq('appointment_id', patient.id);

      const mappedPrescriptions = (rxData || []).map((rx: any) => ({
        brandName: rx.inventory?.brand_name || 'Medicine',
        genericName: rx.inventory?.generic_name || '',
        qty: rx.dispensed_quantity || 1,
        dosage: rx.inventory?.dosage_form || 'Standard',
      }));

      setPatientDetailsRecord({
        clinicalNotes: apptData?.clinical_notes || patient.cancellationReason || '',
        prescriptions: mappedPrescriptions,
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
      className="space-y-5 pb-12"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
            Patient Tables
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified encounter records and cancellation audits for {formatDisplayDate(selectedDate, todayIST)}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex items-center gap-2 px-2.5 py-0.5 cursor-pointer">
              <Calendar className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
              <span className="text-xs font-bold text-slate-800 select-none whitespace-nowrap">
                {formatDisplayDate(selectedDate, todayIST)}
              </span>
              <span className="text-xs font-normal text-slate-400 select-none whitespace-nowrap">
                {selectedDate}
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Pick a date"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDate !== todayIST && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayIST)}
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-semibold transition cursor-pointer"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div className="relative space-y-5">
        <EcgActionLoader isLoading={isLoading} fullscreen={true} text="Syncing patient tables..." />

        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Completed Patients
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                {completedPatients.length} Done
              </span>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse table-fixed min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-4 sm:pl-0 w-[30%]">Patient</th>
                  <th className="pb-3 px-3 w-[22%]">Channel &amp; Token</th>
                  <th className="pb-3 px-3 w-[16%]">Status</th>
                  <th className="pb-3 px-3 w-[20%]">Consultation Time</th>
                  <th className="pb-3 pr-4 sm:pr-0 text-right w-[12%]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedCompleted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No completed consultations recorded for this date.
                    </td>
                  </tr>
                ) : (
                  paginatedCompleted.map((patient) => {
                    const tokenDisplay = formatPatientToken(patient);

                    return (
                      <tr
                        key={patient.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3.5 pl-4 sm:pl-0">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tl from-blue-700 to-blue-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                              {tokenDisplay}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">
                                {patient.name}
                              </span>
                              <span className="text-[11px] text-slate-400 block truncate">
                                {patient.phone || `${patient.age}y • ${patient.gender}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5">
                            <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#2563EB] border border-blue-100/60">
                              Token {tokenDisplay}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {patient.visitType || 'Walk-in'} • {patient.age}y, {patient.gender}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Completed
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span>{patient.time}</span>
                          </div>
                        </td>

                        <td className="py-3.5 pr-4 sm:pr-0 text-right">
                          <button
                            type="button"
                            onClick={() => fetchFullPatientDetails(patient)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#2563EB] transition cursor-pointer hover:underline"
                          >
                            <span>View Details</span>
                            <ArrowRight className="w-3 h-3 text-[#2563EB]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {completedPatients.length > itemsPerPage && (
            <div className="pt-2 border-t border-slate-100">
              <NumberedPagination
                currentPage={completedPage}
                totalPages={completedTotalPages}
                onPageChange={setCompletedPage}
                totalItems={completedPatients.length}
                itemsPerPage={itemsPerPage}
                itemName="completed patients"
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Cancelled Patients
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                {cancelledPatients.length} Cancelled
              </span>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse table-fixed min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-4 sm:pl-0 w-[30%]">Patient</th>
                  <th className="pb-3 px-3 w-[22%]">Channel &amp; Token</th>
                  <th className="pb-3 px-3 w-[16%]">Status</th>
                  <th className="pb-3 px-3 w-[20%]">Cancellation Reason</th>
                  <th className="pb-3 pr-4 sm:pr-0 text-right w-[12%]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedCancelled.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      Zero appointment cancellations logged for this date.
                    </td>
                  </tr>
                ) : (
                  paginatedCancelled.map((patient) => {
                    const tokenDisplay = formatPatientToken(patient);

                    return (
                      <tr
                        key={patient.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3.5 pl-4 sm:pl-0">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {tokenDisplay}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate">
                                {patient.name}
                              </span>
                              <span className="text-[11px] text-slate-400 block truncate">
                                {patient.phone || `${patient.age}y • ${patient.gender}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5">
                            <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                              Token {tokenDisplay}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {patient.visitType || 'Walk-in'} • {patient.age}y, {patient.gender}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Cancelled
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className="text-xs text-slate-600 truncate block max-w-full"
                            title={patient.cancellationReason || 'Cancelled by clinic / patient'}
                          >
                            {patient.cancellationReason || 'Cancelled by clinic / patient'}
                          </span>
                        </td>

                        <td className="py-3.5 pr-4 sm:pr-0 text-right">
                          <button
                            type="button"
                            onClick={() => fetchFullPatientDetails(patient)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#2563EB] transition cursor-pointer hover:underline"
                          >
                            <span>View Details</span>
                            <ArrowRight className="w-3 h-3 text-[#2563EB]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {cancelledPatients.length > itemsPerPage && (
            <div className="pt-2 border-t border-slate-100">
              <NumberedPagination
                currentPage={cancelledPage}
                totalPages={cancelledTotalPages}
                onPageChange={setCancelledPage}
                totalItems={cancelledPatients.length}
                itemsPerPage={itemsPerPage}
                itemName="cancelled patients"
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedPatientForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs ${
                      selectedPatientForDetails.status === 'Completed'
                        ? 'bg-gradient-to-tl from-blue-700 to-blue-500'
                        : 'bg-slate-400'
                    }`}
                  >
                    {formatPatientToken(selectedPatientForDetails)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {selectedPatientForDetails.name}
                      </h3>
                      <span className="text-[10px] font-bold text-[#2563EB] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                        Token {formatPatientToken(selectedPatientForDetails)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      <span>{selectedPatientForDetails.age}y, {selectedPatientForDetails.gender}</span>
                      <span>•</span>
                      <span>Slot: {selectedPatientForDetails.time}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedPatientForDetails.status === 'Completed' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Cancelled
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPatientForDetails(null)}
                    className="w-7 h-7 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-700">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Phone Number
                    </span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {selectedPatientForDetails.phone || 'None'}
                      </span>
                      {selectedPatientForDetails.phone && (
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(selectedPatientForDetails.phone)}
                          className="text-slate-400 hover:text-[#2563EB] ml-1"
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

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Visit Channel
                    </span>
                    <span className="text-xs font-semibold text-slate-800 block mt-0.5">
                      {selectedPatientForDetails.visitType || 'Walk-in'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Triage Priority
                    </span>
                    <span className="text-xs font-semibold text-slate-800 block mt-0.5">
                      {selectedPatientForDetails.priority || 'Normal'}
                    </span>
                  </div>
                </div>

                {selectedPatientForDetails.status === 'Cancelled' && (
                  <div className="bg-rose-50/80 border border-rose-200/80 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>Audit Notice: Reason for Cancellation</span>
                    </div>
                    <p className="text-xs text-rose-700 leading-relaxed font-medium">
                      {selectedPatientForDetails.cancellationReason || 'Appointment cancelled upon patient or clinic staff triage request.'}
                    </p>
                  </div>
                )}

                {selectedPatientForDetails.status === 'Completed' && (
                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Doctor Consultation Notes &amp; Diagnostics</span>
                      </span>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[50px]">
                        {isLoadingDetails ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                            <span>Fetching clinical record...</span>
                          </div>
                        ) : patientDetailsRecord?.clinicalNotes ? (
                          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {patientDetailsRecord.clinicalNotes}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            Patient consultation completed and verified in chamber.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-amber-500" />
                        <span>Prescribed Medicines</span>
                      </span>

                      {isLoadingDetails ? (
                        <div className="text-xs text-slate-400 py-1">Loading prescriptions...</div>
                      ) : patientDetailsRecord?.prescriptions && patientDetailsRecord.prescriptions.length > 0 ? (
                        <div className="space-y-1.5">
                          {patientDetailsRecord.prescriptions.map((rx, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-white shadow-2xs"
                            >
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-800 block truncate">
                                  {rx.brandName}
                                </span>
                                {rx.genericName && (
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    {rx.genericName}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md">
                                {rx.qty} units
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-400 italic border border-slate-100">
                          Standard clinical advice given. No external pharmacy items billed.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2.5">
                {selectedPatientForDetails.phone ? (
                  <a
                    href={`https://wa.me/${selectedPatientForDetails.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
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
                        onPrintRecord(selectedPatientForDetails);
                        setSelectedPatientForDetails(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Print</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPatientForDetails(null)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition cursor-pointer"
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
