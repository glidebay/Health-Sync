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
  Search,
  X,
  CheckCircle2,
  Activity,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Patient } from '@/types';
import { NumberedPagination } from '@/components/ui/pagination';
import { formatPatientToken } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import { EcgActionLoader } from '@/components/loading/EcgActionLoader';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';

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
  itemsPerPage = 6,
}: QueueViewProps) {
  const todayIST = useMemo(() => getTodayIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Waiting' | 'In Progress' | 'Completed' | 'Urgent'>('All');

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, searchQuery, statusFilter]);

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
    const list = dbPatients !== null ? dbPatients : queue;
    const active = list.filter((p) => p.status !== 'Cancelled');
    const notCompleted = active.filter((p) => p.status !== 'Completed');
    const completed = active.filter((p) => p.status === 'Completed');
    return [...notCompleted, ...completed];
  }, [dbPatients, queue]);

  const totalCount = rawPatients.length;
  const waitingCount = rawPatients.filter((p) => p.status === 'Waiting').length;
  const inProgressCount = rawPatients.filter((p) => p.status === 'In Progress').length;
  const completedCount = rawPatients.filter((p) => p.status === 'Completed').length;
  const urgentCount = rawPatients.filter((p) => p.priority === 'Urgent').length;

  const filteredPatients = useMemo(() => {
    return rawPatients.filter((p) => {
      if (statusFilter === 'Waiting' && p.status !== 'Waiting') return false;
      if (statusFilter === 'In Progress' && p.status !== 'In Progress') return false;
      if (statusFilter === 'Completed' && p.status !== 'Completed') return false;
      if (statusFilter === 'Urgent' && p.priority !== 'Urgent') return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const token = formatPatientToken(p).toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
      const matchToken = token.includes(q);
      const matchNotes = p.notes ? p.notes.toLowerCase().includes(q) : false;

      return matchName || matchPhone || matchToken || matchNotes;
    });
  }, [rawPatients, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedQueue = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPatients.slice(start, start + itemsPerPage);
  }, [filteredPatients, currentPage, itemsPerPage]);

  const firstWaitingId = useMemo(() => {
    const fw = rawPatients.find((p) => p.status === 'Waiting');
    return fw?.id;
  }, [rawPatients]);

  return (
    <motion.section
      key="doctor-queue-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 pb-12"
    >
      <EcgActionLoader isLoading={isLoading} fullscreen={true} text="Syncing consultation queue..." />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              Doctor Consultation Queue
            </h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200/60 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Queue
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Live waiting room, priority triage, and direct 1-click consultation entry
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Consultations</span>
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/60">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              <AnimatedCounter value={totalCount} />
            </span>
            <span className="text-[11px] font-medium text-slate-400">for date</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Waiting Room</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/60">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              <AnimatedCounter value={waitingCount} />
            </span>
            <span className="text-[11px] font-medium text-amber-600">in queue</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">In Progress</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              <AnimatedCounter value={inProgressCount} />
            </span>
            <span className="text-[11px] font-medium text-emerald-600">in cabin</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Completed</span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/60">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              <AnimatedCounter value={completedCount} />
            </span>
            <span className="text-[11px] font-medium text-indigo-600">discharged</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name, token ID, phone, or symptoms..."
            className="w-full pl-10 pr-9 py-2 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-wrap">
          {(['All', 'Waiting', 'In Progress', 'Completed', 'Urgent'] as const).map((status) => {
            const count =
              status === 'All'
                ? totalCount
                : status === 'Waiting'
                ? waitingCount
                : status === 'In Progress'
                ? inProgressCount
                : status === 'Completed'
                ? completedCount
                : urgentCount;

            const isActive = statusFilter === status;

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                <span>{status}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-slate-200/50'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[220px]">
        {filteredPatients.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 sm:p-12 border border-slate-100 text-center shadow-xs">
            <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-blue-100/60">
              <Stethoscope className="w-7 h-7 stroke-[1.75]" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {searchQuery || statusFilter !== 'All'
                ? 'No matching patients found in queue'
                : `No active patients for ${formatDisplayDate(selectedDate, todayIST)}`}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'All'
                ? 'Try adjusting your search terms or clearing status filters.'
                : 'Patients registered at the Assistant Desk or booked online via WhatsApp will appear here in real time.'}
            </p>
            {(searchQuery || statusFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                }}
                className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-xl transition"
              >
                Reset Filters
              </button>
            )}
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
                const isWaiting = p.status === 'Waiting';
                const isUrgent = p.priority === 'Urgent';
                const isNextInLine = isWaiting && p.id === firstWaitingId;
                const tokenDisplay = formatPatientToken(p);
                const initials = getInitials(p.name);

                return (
                  <motion.div
                    key={p.id}
                    layout
                    variants={cardVariants}
                    whileHover={!isCompleted ? { y: -3, boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.08)' } : {}}
                    onClick={() => !isCompleted && onStartConsultation(p.id, p)}
                    className={`bg-white rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-300 relative overflow-hidden group ${
                      isCompleted
                        ? 'opacity-65 border-slate-100 cursor-default'
                        : isUrgent
                        ? 'border-amber-200/90 bg-gradient-to-r from-amber-50/30 via-white to-white cursor-pointer hover:border-amber-300'
                        : isInProgress
                        ? 'border-blue-200/90 bg-gradient-to-r from-blue-50/30 via-white to-white cursor-pointer hover:border-blue-300'
                        : 'border-slate-100 cursor-pointer hover:border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-extrabold text-sm border shadow-2xs ${
                              isUrgent
                                ? 'bg-amber-100/80 text-amber-800 border-amber-200'
                                : isInProgress
                                ? 'bg-blue-100/80 text-blue-800 border-blue-200'
                                : isCompleted
                                ? 'bg-slate-100 text-slate-500 border-slate-200'
                                : 'bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 border-blue-100/60'
                            }`}
                          >
                            {initials}
                          </div>
                          {isInProgress && (
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight truncate group-hover:text-blue-600 transition-colors">
                              {p.name}
                            </h3>
                            <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60">
                              {tokenDisplay}
                            </span>
                            {isNextInLine && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs animate-pulse">
                                <Sparkles className="w-2.5 h-2.5" />
                                Next in Line
                              </span>
                            )}
                            {isUrgent && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Urgent
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 mt-1 flex items-center flex-wrap gap-x-2 gap-y-1">
                            <span>
                              {p.age} Yrs • {p.gender}
                            </span>
                            {p.phone && (
                              <>
                                <span className="text-slate-300">•</span>
                                <a
                                  href={`tel:${p.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 transition"
                                >
                                  <Phone className="w-3 h-3 text-blue-600" />
                                  <span>{p.phone}</span>
                                </a>
                              </>
                            )}
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Slot: {p.time}</span>
                            </span>
                          </div>

                          {p.notes && (
                            <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 bg-slate-50/80 px-2.5 py-1 rounded-xl border border-slate-100 inline-flex max-w-full truncate">
                              <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{p.notes}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md flex-shrink-0 inline-flex items-center gap-1 ${
                                isCompleted
                                  ? 'bg-slate-100 text-slate-600'
                                  : isInProgress
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isUrgent
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isCompleted
                                    ? 'bg-slate-400'
                                    : isInProgress
                                    ? 'bg-emerald-500 animate-pulse'
                                    : isUrgent
                                    ? 'bg-amber-500'
                                    : 'bg-blue-500'
                                }`}
                              />
                              {p.status}
                            </span>

                            {p.visitType && (
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md flex-shrink-0 ${
                                  p.visitType.toLowerCase().includes('whatsapp') ||
                                  p.visitType.toLowerCase().includes('online')
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                }`}
                              >
                                {p.visitType.toLowerCase().includes('whatsapp') ||
                                p.visitType.toLowerCase().includes('online')
                                  ? 'Online Booking'
                                  : 'Walk-in Desk'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {isCompleted ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Consulted</span>
                          </div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartConsultation(p.id, p);
                            }}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-2xl shadow-sm hover:shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <span>{isInProgress ? 'Resume Consult' : 'Start Consult'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </motion.button>
                        )}
                      </div>
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
        totalItems={filteredPatients.length}
        itemsPerPage={itemsPerPage}
        itemName="patients"
      />
    </motion.section>
  );
}

export default QueueView;
