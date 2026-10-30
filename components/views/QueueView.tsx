'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, User, Phone, Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Patient } from '@/types';
import { NumberedPagination } from '@/components/ui/pagination';
import { formatPatientToken } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

interface QueueViewProps {
  queue: Patient[];
  onStartConsultation: (id: string, patient?: Patient) => void;
  onRefresh?: () => Promise<void> | void;
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
        console.warn('Error fetching doctor queue for date from DB:', err);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualRefresh = async () => {
    await loadData(false);
    if (onRefresh) {
      try {
        await onRefresh();
      } catch (e) {
        console.warn('onRefresh callback error:', e);
      }
    }
  };

  // Real-time synchronization: listen for appointment changes
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
    <motion.section
      key="queue"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#16191E]">Pending Consultations</h2>
          <p className="text-xs text-[#8A909D]">
            Click any waiting patient to begin consultation & digital charting
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Date Picker Pill identical to Assistant Desk */}
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


        </div>
      </div>

      <div className="relative min-h-[180px]">
        <EcgActionLoader isLoading={isLoading} fullscreen={false} text="Syncing consultation queue..." />
        <div className="space-y-3 sm:space-y-4">
          {currentPatients.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-[#ECEEF2] text-center shadow-xs">
              <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3 stroke-[1.5]" />
              <h3 className="text-sm font-bold text-[#16191E]">No Active Patients in Consultation Queue</h3>
              <p className="text-xs text-[#8A909D] mt-1 max-w-sm mx-auto">
                Patients for {formatDisplayDate(selectedDate, todayIST)} registered at the Assistant Desk will appear here in real time.
              </p>
            </div>
          ) : (
            paginatedQueue.map((p) => {
              const isCompleted = p.status === 'Completed';
              return (
                <motion.div
                  key={p.id}
                  whileHover={!isCompleted ? { y: -3, boxShadow: '0 10px 24px -6px rgba(0,0,0,0.07)' } : {}}
                  onClick={() => !isCompleted && onStartConsultation(p.id, p)}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isCompleted ? 'opacity-60 cursor-default' : 'cursor-pointer hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                    <motion.div
                      whileHover={{ rotate: 8 }}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] flex-shrink-0"
                    >
                      <User className="w-5 h-5 stroke-[2]" />
                    </motion.div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-[#16191E] truncate">{p.name}</h3>
                        <span className="text-xs text-[#8A909D] font-medium flex-shrink-0">
                          ({formatPatientToken(p)})
                        </span>
                        {p.priority === 'Urgent' && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5E6470] mt-0.5 truncate flex items-center flex-wrap gap-1">
                        <span>{p.age} Yrs • {p.gender}</span>
                        {p.phone && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-gray-600">
                              <Phone className="w-3 h-3 text-[#2563EB]" />
                              {p.phone}
                            </span>
                          </>
                        )}
                        <span>• Slot: {p.time}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${isCompleted
                              ? 'bg-gray-100 text-gray-600'
                              : p.status === 'In Progress'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'Cancelled'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-blue-50 text-blue-700'
                            }`}
                        >
                          {p.status}
                        </span>
                        {p.visitType && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1 ${p.visitType.toLowerCase().includes('whatsapp') || p.visitType.toLowerCase().includes('online')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                          >
                            {p.visitType.toLowerCase().includes('whatsapp') || p.visitType.toLowerCase().includes('online') ? 'Online' : 'Walk-in'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#ECEEF2]">
                    {!isCompleted && (
                      <span className="text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs whitespace-nowrap">
                        Start Consult &rarr;
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
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
    </motion.section>
  );
}

export default QueueView;
