'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Users,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  RotateCcw,
} from 'lucide-react';
import { Patient } from '@/types';
import { NumberedPagination } from '@/components/ui/pagination';
import { RescheduleModal, ReallocateStrategy } from './RescheduleModal';
import { CancelModal } from './CancelModal';
import { formatPatientToken } from '@/lib/utils';
import {
  fetchPatientAppointmentsFromDb,
  fetchAppointmentDateCountsFromDb,
  AppointmentDateCounts,
} from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';

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

/**
 * Helper: Today's date in Indian Standard Time (Asia/Kolkata) as YYYY-MM-DD
 */
function getTodayIST(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Helper: Formats YYYY-MM-DD into a friendly label (e.g., "Today", "Wed, Oct 28")
 */
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

/**
 * Helper: Shifts a YYYY-MM-DD date by N days
 */
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
  itemsPerPage = 10,
}: QueueListProps) {
  const todayIST = useMemo(() => getTodayIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [counts, setCounts] = useState<AppointmentDateCounts>({
    date: todayIST,
    total: 0,
    waiting: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [selectedPatientForReschedule, setSelectedPatientForReschedule] = useState<Patient | null>(null);
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedStatus, debouncedSearch]);

  // Primary data loader querying Supabase RPCs
  const loadData = useCallback(
    async (silent: boolean = false) => {
      if (!silent) setIsLoading(true);
      try {
        const [fetchedPatients, fetchedCounts] = await Promise.all([
          fetchPatientAppointmentsFromDb({
            date: selectedDate,
            status: selectedStatus,
            search: debouncedSearch,
          }),
          fetchAppointmentDateCountsFromDb(selectedDate),
        ]);

        setDbPatients(fetchedPatients);
        setCounts(fetchedCounts);
      } catch (err) {
        console.warn('Error fetching filtered queue from DB:', err);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [selectedDate, selectedStatus, debouncedSearch]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization: listen for appointment changes
  useEffect(() => {
    const channel = supabase
      .channel('realtime-queue-list-filter')
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

  // Fallback to prop queue if initial load is resolving and on today with All filter
  const currentPatients = useMemo(() => {
    if (dbPatients !== null) return dbPatients;

    let fallback = [...queue];
    if (selectedStatus !== 'All') {
      fallback = fallback.filter((p) => p.status.toLowerCase() === selectedStatus.toLowerCase());
    }
    return fallback;
  }, [dbPatients, queue, selectedStatus]);

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

  const statusTabs = [
    { key: 'All', label: 'All', count: counts.total },
    { key: 'Waiting', label: 'Waiting', count: counts.waiting },
    { key: 'In Progress', label: 'In Progress', count: counts.in_progress },
    { key: 'Completed', label: 'Completed', count: counts.completed },
    { key: 'Cancelled', label: 'Cancelled', count: counts.cancelled },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#16191E]">Assistant Queue Oversight</h2>
          <p className="text-xs text-[#8A909D]">
            Coordinate daily patients, track appointments by date, and manage statuses
          </p>
        </div>
        {onRegisterWalkin && (
          <motion.button
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onRegisterWalkin}
            className="bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center space-x-1.5 shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Register Walk-in</span>
          </motion.button>
        )}
      </div>

      {/* Filter & Date Control Panel */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#ECEEF2] shadow-xs space-y-3">
        {/* Row 1: Date Navigation & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Date Selector Capsule */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-[#F8F9FB] rounded-xl border border-[#ECEEF2] p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-gray-600 hover:text-[#16191E] transition cursor-pointer"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex items-center gap-1.5 px-2.5 py-1 cursor-pointer group">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                <span className="text-xs font-bold text-[#16191E] select-none whitespace-nowrap">
                  {formatDisplayDate(selectedDate, todayIST)}
                </span>
                <span className="text-[11px] font-mono text-[#8A909D] hidden md:inline">
                  {selectedDate}
                </span>
                {/* Native date picker invisible overlay */}
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
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-gray-600 hover:text-[#16191E] transition cursor-pointer"
                title="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Jump to Today button (only shown when not on today) */}
            {selectedDate !== todayIST && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayIST)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                title="Return to today"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Today</span>
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#8A909D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#F8F9FB] focus:bg-white rounded-xl border border-[#ECEEF2] text-xs text-[#16191E] placeholder-[#8A909D] focus:outline-none focus:border-[#2563EB] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A909D] hover:text-[#16191E] p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-[#ECEEF2]/80">
          {statusTabs.map((tab) => {
            const isSelected = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedStatus(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap select-none ${
                  isSelected
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'bg-[#F8F9FB] text-[#5E6470] hover:bg-gray-100 hover:text-[#16191E] border border-[#ECEEF2]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-[#8A909D] border border-gray-200/60'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Patient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {paginatedQueue.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-10 border border-[#ECEEF2] text-center shadow-xs">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-bold text-[#16191E]">
              {isLoading
                ? 'Loading appointments...'
                : `No ${selectedStatus !== 'All' ? selectedStatus.toLowerCase() + ' ' : ''}appointments found`}
            </h3>
            <p className="text-xs text-[#8A909D] mt-1 max-w-sm mx-auto">
              {isLoading
                ? 'Querying database for live schedule and token counts...'
                : `There are no matching patients for ${formatDisplayDate(selectedDate, todayIST)}. Try switching status tabs or picking another date.`}
            </p>
          </div>
        ) : (
          paginatedQueue.map((p) => {
            const isWaiting = p.status === 'Waiting';
            const isCancelled = p.status === 'Cancelled';
            const tokenDisplay = formatPatientToken(p);

            return (
              <motion.div
                key={p.id}
                whileHover={{ y: -2 }}
                className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-sm flex items-center justify-between gap-3 transition-colors ${
                  isCancelled ? 'border-rose-100 bg-rose-50/20' : 'border-[#ECEEF2]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-[#16191E] truncate">{p.name}</span>
                    <span className="text-xs text-[#8A909D] font-medium flex-shrink-0">
                      ({tokenDisplay})
                    </span>
                    {p.priority === 'Urgent' && (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0">
                        Urgent
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#8A909D] font-medium mt-1 truncate flex items-center flex-wrap gap-1">
                    <span>
                      {p.age} Yrs • {p.gender}
                    </span>
                    {p.phone && (
                      <>
                        <span>•</span>
                        <a
                          href={`tel:${p.phone}`}
                          className="inline-flex items-center gap-1 text-[#5E6470] hover:text-[#2563EB] transition"
                        >
                          <Phone className="w-3 h-3 text-[#2563EB]" />
                          {p.phone}
                        </a>
                      </>
                    )}
                    <span>• Slot: {p.time}</span>
                  </p>

                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                        p.status === 'Completed'
                          ? 'bg-gray-100 text-gray-600'
                          : p.status === 'In Progress'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'Cancelled'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {p.status}
                    </span>

                    {p.visitType && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1 ${
                          p.visitType.toLowerCase().includes('whatsapp') ||
                          p.visitType.toLowerCase().includes('online')
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {p.visitType.toLowerCase().includes('whatsapp') ||
                        p.visitType.toLowerCase().includes('online')
                          ? 'Online'
                          : 'Walk-in'}
                      </span>
                    )}

                    {isCancelled && p.cancellationReason && (
                      <span
                        className="text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md truncate max-w-[200px]"
                        title={p.cancellationReason}
                      >
                        Reason: {p.cancellationReason}
                      </span>
                    )}
                  </div>
                </div>

                {isWaiting && (
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedPatientForCancel(p)}
                      className="text-xs font-semibold px-3 py-1.5 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedPatientForReschedule(p)}
                      className="text-xs font-semibold px-3 py-1.5 border border-blue-200 text-[#2563EB] rounded-xl hover:bg-blue-50 transition cursor-pointer"
                    >
                      Reschedule
                    </motion.button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <NumberedPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={currentPatients.length}
        itemsPerPage={itemsPerPage}
        itemName="patients"
      />

      {/* Modals */}
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
