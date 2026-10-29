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
} from 'lucide-react';
import { Patient } from '@/types';
import { NumberedPagination } from '@/components/ui/pagination';
import { RescheduleModal, ReallocateStrategy } from './RescheduleModal';
import { CancelModal } from './CancelModal';
import { formatPatientToken } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [selectedPatientForReschedule, setSelectedPatientForReschedule] = useState<Patient | null>(null);
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null);

  // Reset page when date changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  // Primary data loader querying Supabase RPC for the selected date
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
  }, [loadData]);

  // Real-time synchronization: listen for appointment changes
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

  // Filter out cancelled by default and put completed at the end
  const currentPatients = useMemo(() => {
    const list = dbPatients !== null ? dbPatients : queue;
    const active = list.filter((p) => p.status !== 'Cancelled');
    const notCompleted = active.filter((p) => p.status !== 'Completed');
    const completed = active.filter((p) => p.status === 'Completed');
    return [...notCompleted, ...completed];
  }, [dbPatients, queue]);

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
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header with Date Pill & Register Walk-in */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#16191E]">Assistant Queue Oversight</h2>
          <p className="text-xs text-[#8A909D]">
            Coordinate incoming walk-in patients and manage token allocations
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Date Picker Pill from Image */}
          <div className="relative flex items-center bg-[#F8F9FB] hover:bg-[#F0F2F5] rounded-2xl border border-[#ECEEF2] p-1 shadow-2xs transition">
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white text-gray-500 hover:text-[#16191E] transition cursor-pointer"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex items-center gap-2 px-2.5 py-0.5 cursor-pointer">
              <Calendar className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
              <span className="text-xs font-bold text-[#16191E] select-none whitespace-nowrap">
                {formatDisplayDate(selectedDate, todayIST)}
              </span>
              <span className="text-xs font-normal text-[#8A909D] select-none whitespace-nowrap">
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
              className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white text-gray-500 hover:text-[#16191E] transition cursor-pointer"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
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
      </div>

      {/* Patient Cards Grid with Scoped ECG Action Loader */}
      <div className="relative min-h-[180px]">
        <EcgActionLoader isLoading={isLoading} text="Syncing appointments..." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {paginatedQueue.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-10 border border-[#ECEEF2] text-center shadow-xs">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3 stroke-[1.5]" />
              <h3 className="text-sm font-bold text-[#16191E]">
                No patients found for {formatDisplayDate(selectedDate, todayIST)}
              </h3>
              <p className="text-xs text-[#8A909D] mt-1 max-w-sm mx-auto">
                Use the &quot;Register Walk-in&quot; button above or WhatsApp self-service booking to add patients.
              </p>
            </div>
          ) : (
          paginatedQueue.map((p) => {
            const isWaiting = p.status === 'Waiting';
            const tokenDisplay = formatPatientToken(p);

            return (
              <motion.div
                key={p.id}
                whileHover={{ y: -2 }}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex items-center justify-between gap-3"
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
