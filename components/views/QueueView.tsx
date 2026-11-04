'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowRight,
  User,
  AlertTriangle,
} from 'lucide-react';
import { Patient } from '@/types';
import { NumberedPagination } from '@/components/ui/pagination';
import { formatPatientToken } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import { EcgActionLoader } from '@/components/loading/EcgActionLoader';

interface QueueViewProps {
  queue: Patient[];
  onStartConsultation: (id: string, patient?: Patient) => void;
  onRefresh?: () => Promise<void> | void;
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

export function QueueView({
  queue,
  onStartConsultation,
  onRefresh,
  itemsPerPage = 5,
}: QueueViewProps) {
  const todayIST = useMemo(() => getTodayIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
        console.warn('Error fetching doctor queue for date from DB:', err);
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
      .channel(`realtime-doctor-queue-${selectedDate}`)
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
  }, [loadData, selectedDate]);

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
    <motion.section
      key="doctor-queue-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6 pb-10"
    >
      <EcgActionLoader isLoading={isLoading} fullscreen={true} text="Syncing consultation queue..." />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
            Doctor Consultation Queue
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live waiting room and direct 1-click consultation entry
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
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
        </div>
      </div>

      <div className="relative min-h-[200px]">
        {currentPatients.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 sm:p-12 border border-slate-100 text-center shadow-xs">
            <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-blue-100/60">
              <Stethoscope className="w-7 h-7 stroke-[1.75]" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No patients in queue for {formatDisplayDate(selectedDate, todayIST)}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Patients registered at the Assistant Desk or booked online via WhatsApp will appear here automatically.
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3 sm:space-y-4"
          >
            <AnimatePresence mode="popLayout">
              {paginatedQueue.map((p) => {
                const isCompleted = p.status === 'Completed';
                const isInProgress = p.status === 'In Progress';
                const isUrgent = p.priority === 'Urgent';
                const tokenDisplay = formatPatientToken(p);
                const initials = getInitials(p.name);
                const isOnline =
                  (p.visitType || '').toLowerCase().includes('whatsapp') ||
                  (p.visitType || '').toLowerCase().includes('online');

                return (
                  <motion.div
                    key={p.id}
                    variants={cardVariants}
                    whileHover={!isCompleted ? { y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.06)' } : {}}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    onClick={() => !isCompleted && onStartConsultation(p.id, p)}
                    className={`bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCompleted
                        ? 'opacity-65 cursor-default'
                        : 'cursor-pointer hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100/60 shadow-2xs">
                          {initials}
                        </div>
                        {isInProgress && (
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight truncate hover:text-blue-600 transition-colors">
                            {p.name}
                          </h3>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60 flex-shrink-0">
                            {tokenDisplay}
                          </span>
                          {isUrgent && (
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
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Phone className="w-3 h-3 text-blue-500" />
                                <span>{p.phone}</span>
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Slot: {p.time}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex-shrink-0 ${
                              isCompleted
                                ? 'bg-slate-100 text-slate-600 border-slate-200/60'
                                : isInProgress
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-blue-50 text-blue-700 border-blue-200/60'
                            }`}
                          >
                            {p.status}
                          </span>

                          {p.visitType && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex-shrink-0 ${
                                isOnline
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                              }`}
                            >
                              {isOnline ? 'Online' : 'Walk-in'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-shrink-0">
                      {!isCompleted ? (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className="text-xs font-semibold px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xs hover:shadow-md transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <span>Start Consult</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </motion.button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">
                          Completed
                        </span>
                      )}
                    </div>
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
    </motion.section>
  );
}

export default QueueView;
