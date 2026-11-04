'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Users,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  UserCheck,
  Globe,
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

function getInitials(name: string): string {
  if (!name) return 'PT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function QueueList({
  queue,
  onRegisterWalkin,
  onCancelAppointment,
  onReschedulePatient,
  onStartConsultation,
  itemsPerPage = 10,
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
        });
        setDbPatients(fetchedPatients);
      } catch (err) {
        console.warn('Error fetching queue for date from DB:', err);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData(true);
    }, 2500);

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
      .channel('realtime-queue-list-date')
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

  const rawPatients = useMemo(() => {
    return dbPatients !== null ? dbPatients : queue;
  }, [dbPatients, queue]);

  const currentPatients = useMemo(() => {
    const active = rawPatients.filter((p) => p.status !== 'Cancelled');
    const notCompleted = active.filter((p) => p.status !== 'Completed');
    const completed = active.filter((p) => p.status === 'Completed');
    return [...notCompleted, ...completed];
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
    <div className="space-y-4 sm:space-y-6 pb-10">
      <EcgActionLoader isLoading={isLoading} fullscreen={true} text="Syncing appointments..." />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
            Assistant Queue Oversight
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Coordinate incoming walk-in patients and manage token allocations
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <div className="relative flex items-center bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-1 shadow-xs hover:border-slate-300 transition-all">
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex items-center gap-2 px-2.5 py-0.5 cursor-pointer">
              <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-bold text-slate-800 select-none whitespace-nowrap">
                {formatDisplayDate(selectedDate, todayIST)}
              </span>
              <span className="text-xs font-medium text-slate-400 select-none whitespace-nowrap">
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
              className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedDate !== todayIST && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayIST)}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shadow-2xs"
            >
              Today
            </button>
          )}

          {onRegisterWalkin && (
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onRegisterWalkin}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Register Walk-in</span>
            </motion.button>
          )}
        </div>
      </div>

      <div className="relative min-h-[200px]">
        {currentPatients.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 sm:p-12 border border-slate-100 text-center shadow-xs">
            <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-blue-100/60">
              <Users className="w-7 h-7 stroke-[1.75]" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No patients found for {formatDisplayDate(selectedDate, todayIST)}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Use the &quot;Register Walk-in&quot; button above or WhatsApp self-service booking to add patients.
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4"
          >
            <AnimatePresence mode="popLayout">
              {paginatedQueue.map((p) => {
                const isWaiting = p.status === 'Waiting';
                const isInProgress = p.status === 'In Progress';
                const isCompleted = p.status === 'Completed';
                const tokenDisplay = formatPatientToken(p);
                const initials = getInitials(p.name);
                const isOnline =
                  (p.visitType || '').toLowerCase().includes('whatsapp') ||
                  (p.visitType || '').toLowerCase().includes('online');

                return (
                  <motion.div
                    key={p.id}
                    variants={cardVariants}
                    whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.06)' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    className={`bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs hover:border-slate-200 flex flex-col justify-between gap-3 ${
                      isCompleted ? 'opacity-65' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs border border-blue-100/60 shadow-2xs flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-800 truncate">{p.name}</h4>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60 flex-shrink-0">
                                {tokenDisplay}
                              </span>
                              {p.priority === 'Urgent' && (
                                <span className="bg-rose-50 text-rose-700 border border-rose-200/70 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                                  Urgent
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-medium flex-wrap">
                              <span>
                                {p.age} Yrs • {p.gender}
                              </span>
                              {p.phone && (
                                <>
                                  <span>•</span>
                                  <a
                                    href={`tel:${p.phone}`}
                                    className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 transition"
                                  >
                                    <Phone className="w-3 h-3 text-blue-500" />
                                    <span>{p.phone}</span>
                                  </a>
                                </>
                              )}
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Slot: {p.time}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              isCompleted
                                ? 'bg-slate-100 text-slate-600 border-slate-200/60'
                                : isInProgress
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-blue-50 text-blue-700 border-blue-200/60'
                            }`}
                          >
                            {p.status}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                              isOnline
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                            }`}
                          >
                            {isOnline ? (
                              <>
                                <Globe className="w-2.5 h-2.5" />
                                <span>Online</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-2.5 h-2.5" />
                                <span>Walk-in</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isWaiting && (
                      <div className="flex items-center justify-end space-x-2 pt-1 flex-shrink-0">
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setSelectedPatientForCancel(p)}
                          className="text-xs font-semibold px-3 py-1.5 border border-rose-200/80 text-rose-600 rounded-2xl hover:bg-rose-50 transition cursor-pointer"
                        >
                          Cancel
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setSelectedPatientForReschedule(p)}
                          className="text-xs font-semibold px-3 py-1.5 border border-blue-200/80 text-blue-600 rounded-2xl hover:bg-blue-50 transition cursor-pointer"
                        >
                          Reschedule
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
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
