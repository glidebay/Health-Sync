'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Patient } from '@/types';
import { NumberedPagination } from '@/components/ui/pagination';
import { RescheduleModal, ReallocateStrategy } from './RescheduleModal';
import { CancelModal } from './CancelModal';
import { formatPatientToken } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import { EcgActionLoader } from '@/components/loading/EcgActionLoader';

interface QueueListProps {
  queue: Patient[];
  onRegisterWalkin?: () => void;
  onCancelAppointment: (patientId: string, reason: string) => Promise<void> | void;
  onReschedulePatient: (params: {
    patientId: string;
    strategy: ReallocateStrategy;
    newSlotTime: string;
    reason: string;
    swapWithPatientId?: string;
    delayMinutes?: number;
    cascadeAll?: boolean;
    setUrgentPriority?: boolean;
  }) => Promise<void> | void;
  onStartConsultation?: (patientId: string) => void;
  itemsPerPage?: number;
  locationId?: string;
  clinicId?: string;
}

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

export function QueueList({
  queue,
  onRegisterWalkin,
  onCancelAppointment,
  onReschedulePatient,
  onStartConsultation,
  itemsPerPage = 10,
  locationId,
  clinicId,
}: QueueListProps) {
  const todayIST = useMemo(() => getTodayIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [selectedPatientForReschedule, setSelectedPatientForReschedule] = useState<Patient | null>(null);
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  const loadData = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setIsLoading(true);
      try {
        const fetchedPatients = await fetchPatientAppointmentsFromDb({
          date: selectedDate,
          status: 'All',
          locationId,
          clinicId,
        });
        setDbPatients(fetchedPatients);
      } catch (err) {
        console.warn('Error fetching queue for date from DB:', err);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [selectedDate, locationId, clinicId]
  );

  useEffect(() => {
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

    // Supabase Realtime WebSocket subscription (instant updates on queue list)
    const channel = supabase
      .channel('realtime-queue-list-date')
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

  const rawPatients = useMemo(() => {
    return dbPatients !== null ? dbPatients : queue;
  }, [dbPatients, queue]);

  const currentPatients = useMemo(() => {
    return rawPatients.filter((p) => p.status !== 'Cancelled' && p.status !== 'Completed');
  }, [rawPatients]);

  const totalPages = Math.max(1, Math.ceil(currentPatients.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedQueue = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return currentPatients.slice(start, start + itemsPerPage);
  }, [currentPatients, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6 pb-10">
      <EcgActionLoader isLoading={isLoading} fullscreen={true} text="Syncing appointments..." />

      {/* Editorial Section Header + Divided Queue List (matches Doctor Queue) */}
      <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-8 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
              Live Queue • {currentPatients.length} {currentPatients.length === 1 ? 'Patient' : 'Patients'}
            </span>
            <h2 className="mt-1.5 text-base sm:text-lg font-semibold text-[#16191E]">
              Assistant Queue Oversight
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Manage walk-in registrations, token allocations, reschedules, and cancellations.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <div className="relative flex items-center bg-white rounded-xl border border-[#ECEEF2] p-1 shadow-2xs hover:border-slate-300 transition-all">
              <button
                type="button"
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex items-center gap-2 px-2.5 py-0.5 cursor-pointer">
                <Calendar className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-800 select-none whitespace-nowrap">
                  {formatDisplayDate(selectedDate, todayIST)}
                </span>
                <span className="text-[11px] font-normal text-slate-400 select-none whitespace-nowrap">
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
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Today
              </button>
            )}

            {onRegisterWalkin && (
              <button
                type="button"
                onClick={onRegisterWalkin}
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-2xs transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Walk-in</span>
              </button>
            )}
          </div>
        </div>

        {/* Divided Queue List */}
        <div className="mt-7">
          {currentPatients.length === 0 ? (
            <div className="border-y border-slate-200/80 py-12 text-center">
              <div className="w-11 h-11 rounded-full border border-slate-200 bg-slate-50 text-slate-500 flex items-center justify-center mx-auto mb-3.5">
                <Users className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h3 className="text-sm font-medium text-slate-800">
                No patients found for {formatDisplayDate(selectedDate, todayIST)}
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
                Use &quot;Register Walk-in&quot; above or WhatsApp self-service booking to add patients.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
              {paginatedQueue.map((p, index) => {
                const isWaiting = p.status === 'Waiting';
                const isInProgress = p.status === 'In Progress';
                const isCompleted = p.status === 'Completed';
                const isUrgent = p.priority === 'Urgent';
                const tokenDisplay = formatPatientToken(p);
                const rowNumber = String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0');
                const isOnline =
                  (p.visitType || '').toLowerCase().includes('whatsapp') ||
                  (p.visitType || '').toLowerCase().includes('online');

                return (
                  <li key={p.id}>
                    <div
                      className={`group grid grid-cols-1 gap-4 py-5 sm:py-6 transition-colors sm:grid-cols-[2.75rem_1fr_auto] sm:gap-6 lg:grid-cols-[2.75rem_1fr_1.5fr_auto] lg:gap-10 items-start sm:items-center ${
                        isCompleted
                          ? 'opacity-55'
                          : 'hover:bg-slate-50/70 -mx-6 sm:-mx-8 px-6 sm:px-8'
                      }`}
                    >
                      {/* Index */}
                      <span className="text-xs font-medium text-slate-400 tabular-nums sm:pt-0.5">
                        {rowNumber}
                      </span>

                      {/* Title + Token & Time Subtitle */}
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-sm sm:text-base font-semibold text-[#16191E] truncate">
                            {p.name}
                          </h3>
                          {isInProgress && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              In Progress
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Token {tokenDisplay} • Slot: {p.time}
                        </p>
                      </div>

                      {/* Description + Outline Pill Tags */}
                      <div className="sm:col-start-2 lg:col-start-auto min-w-0 space-y-2.5">
                        <p className="text-xs leading-5 text-slate-500 flex flex-wrap items-center gap-x-2">
                          <span>{p.age} Years, {p.gender}</span>
                          {p.phone && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>
                                Phone:{' '}
                                <a
                                  href={`tel:${p.phone}`}
                                  className="text-slate-600 hover:text-blue-600 hover:underline transition-colors"
                                >
                                  {p.phone}
                                </a>
                              </span>
                            </>
                          )}
                        </p>
                        <ul
                          aria-label="Queue Metadata"
                          className="flex flex-wrap gap-2"
                        >
                          <li className="rounded-full border border-slate-200 px-3 py-0.5 text-[11px] font-normal text-slate-600 bg-white">
                            {p.status}
                          </li>
                          <li className="rounded-full border border-slate-200 px-3 py-0.5 text-[11px] font-normal text-slate-600 bg-white">
                            {isOnline ? 'Online (WhatsApp)' : 'Walk-in Visit'}
                          </li>
                          {isUrgent && (
                            <li className="rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-[11px] font-medium text-rose-700">
                              Urgent Priority
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Row Actions */}
                      <div className="flex items-center justify-end gap-2.5 sm:col-start-3 sm:row-start-1 lg:col-start-4">
                        {isWaiting ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedPatientForCancel(p)}
                              className="inline-flex items-center rounded-full border border-rose-200/80 bg-white px-4 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-600 hover:text-white hover:border-rose-600 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPatientForReschedule(p)}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] cursor-pointer"
                            >
                              Reschedule
                            </button>
                          </>
                        ) : (
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                              isCompleted
                                ? 'border-slate-200 bg-slate-50 text-slate-400'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <NumberedPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={currentPatients.length}
        itemsPerPage={itemsPerPage}
        itemName="patients"
      />

      <CancelModal
        isOpen={!!selectedPatientForCancel}
        patient={selectedPatientForCancel}
        onClose={() => setSelectedPatientForCancel(null)}
        onConfirmCancel={async (id, reason) => {
          await onCancelAppointment(id, reason);
          loadData(true);
        }}
      />

      <RescheduleModal
        isOpen={!!selectedPatientForReschedule}
        patient={selectedPatientForReschedule}
        queue={currentPatients.length > 0 ? currentPatients : queue}
        onClose={() => setSelectedPatientForReschedule(null)}
        onReschedulePatient={async (params) => {
          await onReschedulePatient(params);
          loadData(true);
        }}
      />
    </div>
  );
}

export default QueueList;
