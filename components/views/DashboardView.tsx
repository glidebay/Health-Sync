'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  CheckCircle2,
  Boxes,
  Plus,
  Stethoscope,
  Clock,
  Pill,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Flame,
  Check,
  ShieldCheck,
  MessageSquare,
  MousePointer,
  ShoppingBag,
  Package,
} from 'lucide-react';
import { Patient } from '@/types';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { AnimatedProgress } from '@/components/common/AnimatedProgress';
import { staggerContainer, fadeScale } from '@/lib/constants';
import { RescheduleModal, ReallocateStrategy } from '@/components/reception/RescheduleModal';
import { CancelModal } from '@/components/reception/CancelModal';
import { NumberedPagination } from '@/components/ui/pagination';
import { formatPatientToken, getTodayIST } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';

interface DashboardViewProps {
  totalPatientsCount: number;
  completedPatientsCount: number;
  totalStockUnits: number;
  inChamberPatient?: Patient;
  nextWaitingPatient?: Patient;
  waitingPatientsCount: number;
  filteredQueue: Patient[];
  queue: Patient[];
  isLoggedIn: boolean;
  onRegisterWalkin: () => void;
  onViewAllQueue: () => void;
  onReallocate?: (id: string) => void;
  onCancelAppointment?: (patientId: string, reason: string) => Promise<void> | void;
  onReschedulePatient?: (params: {
    patientId: string;
    strategy: ReallocateStrategy;
    newSlotTime: string;
    reason: string;
    swapWithPatientId?: string;
    delayMinutes?: number;
    cascadeAll?: boolean;
    setUrgentPriority?: boolean;
  }) => Promise<void> | void;
  onStartConsultation: (id: string) => void;
  onRequireLogin: () => void;
  onQueueUpdated?: (patients: Patient[]) => void;
  onRefresh?: () => Promise<void> | void;
}

export function DashboardView({
  totalPatientsCount,
  completedPatientsCount,
  totalStockUnits,
  inChamberPatient,
  nextWaitingPatient,
  waitingPatientsCount,
  filteredQueue,
  queue,
  isLoggedIn,
  onRegisterWalkin,
  onViewAllQueue,
  onReallocate,
  onCancelAppointment,
  onReschedulePatient,
  onStartConsultation,
  onRequireLogin,
  onQueueUpdated,
  onRefresh,
}: DashboardViewProps) {
  const [selectedPatientForReschedule, setSelectedPatientForReschedule] = useState<Patient | null>(null);
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number>(4);

  const itemsPerPage = 6;

  const loadData = useCallback(
    async (silent: boolean = true) => {
      try {
        const fetched = await fetchPatientAppointmentsFromDb({
          date: getTodayIST(),
          status: 'All',
        });
        if (Array.isArray(fetched)) {
          setDbPatients(fetched);
          if (onQueueUpdated) {
            onQueueUpdated(fetched);
          }
        }
      } catch (err) {
        console.warn('Dashboard live queue fetch error:', err);
      }
    },
    [onQueueUpdated]
  );

  useEffect(() => {
    loadData(true);

    const interval = setInterval(() => {
      loadData(true);
    }, 2500);

    const handleSync = () => {
      loadData(true);
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    const channel = supabase
      .channel(`realtime-dashboard-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        loadData(true);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const effectiveQueue = useMemo(() => {
    const list = dbPatients !== null ? dbPatients : filteredQueue;
    const active = list.filter((p) => p.status !== 'Cancelled');
    const notCompleted = active.filter((p) => p.status !== 'Completed');
    const completed = active.filter((p) => p.status === 'Completed');
    return [...notCompleted, ...completed];
  }, [dbPatients, filteredQueue]);

  const activePatientsList = useMemo(() => {
    return (dbPatients !== null ? dbPatients : queue).filter((p) => p.status !== 'Cancelled');
  }, [dbPatients, queue]);

  const effectiveTotalCount = dbPatients !== null ? activePatientsList.length : totalPatientsCount;
  const effectiveWaitingCount = dbPatients !== null ? activePatientsList.filter((p) => p.status === 'Waiting').length : waitingPatientsCount;
  const effectiveCompletedCount = dbPatients !== null ? activePatientsList.filter((p) => p.status === 'Completed').length : completedPatientsCount;
  const effectiveInChamber = dbPatients !== null ? activePatientsList.find((p) => p.status === 'In Progress') : inChamberPatient;
  const effectiveNextWaiting = dbPatients !== null ? activePatientsList.find((p) => p.status === 'Waiting') : nextWaitingPatient;

  const onlineAppointmentsCount = useMemo(() => {
    return activePatientsList.filter((p) => {
      const vt = (p.visitType || '').toLowerCase();
      return vt.includes('whatsapp') || vt.includes('online');
    }).length;
  }, [activePatientsList]);

  const completionRate = effectiveTotalCount > 0
    ? Math.round((effectiveCompletedCount / effectiveTotalCount) * 100)
    : 0;

  const totalPages = Math.max(1, Math.ceil(effectiveQueue.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedQueue = useMemo(() => {
    return effectiveQueue.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [effectiveQueue, currentPage, itemsPerPage]);

  const barChartValues = useMemo(() => [330, 140, 80, 220, 380, 150, 310, 170, 360], []);

  const months = useMemo(() => ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);
  const walkinData = useMemo(() => [510, 580, 550, 610, 640, 620, 690, 730, 780], []);
  const whatsappData = useMemo(() => [340, 410, 430, 490, 530, 570, 640, 710, 790], []);

  const lineChartXCoords = useMemo(() => [60, 129, 198, 266, 335, 404, 473, 541, 610], []);

  const pts1 = useMemo(() => {
    return lineChartXCoords.map((x, i) => ({
      x,
      y: 220 - (walkinData[i] / 800) * 180,
    }));
  }, [lineChartXCoords, walkinData]);

  const pts2 = useMemo(() => {
    return lineChartXCoords.map((x, i) => ({
      x,
      y: 220 - (whatsappData[i] / 800) * 180,
    }));
  }, [lineChartXCoords, whatsappData]);

  const getCubicBezierPath = useCallback((points: { x: number; y: number }[]) => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }, []);

  const splinePath1 = useMemo(() => getCubicBezierPath(pts1), [getCubicBezierPath, pts1]);
  const splineAreaPath1 = useMemo(() => {
    if (!splinePath1) return '';
    return `${splinePath1} L 610 220 L 60 220 Z`;
  }, [splinePath1]);

  const splinePath2 = useMemo(() => getCubicBezierPath(pts2), [getCubicBezierPath, pts2]);

  const activityLog = useMemo(() => {
    const items = [];
    if (effectiveInChamber) {
      items.push({
        id: 'in-chamber',
        title: `Token ${formatPatientToken(effectiveInChamber)} in Consultation`,
        subtitle: `${effectiveInChamber.name} (${effectiveInChamber.age}y, ${effectiveInChamber.gender}) in Chamber`,
        time: effectiveInChamber.time || 'Live Now',
        icon: Stethoscope,
        color: 'from-emerald-500 to-teal-400',
      });
    }

    const recentlyCompleted = activePatientsList.filter((p) => p.status === 'Completed').slice(-1);
    recentlyCompleted.forEach((p) => {
      items.push({
        id: `comp-${p.id}`,
        title: `Token ${formatPatientToken(p)} Completed`,
        subtitle: `Rx charting finalized for ${p.name}`,
        time: p.time || 'Recent',
        icon: CheckCircle2,
        color: 'from-blue-600 to-indigo-500',
      });
    });

    if (effectiveNextWaiting) {
      items.push({
        id: 'next-waiting',
        title: `Token ${formatPatientToken(effectiveNextWaiting)} Next in Line`,
        subtitle: `${effectiveNextWaiting.name} at Waiting Lounge`,
        time: effectiveNextWaiting.time || 'Next Slot',
        icon: Clock,
        color: 'from-indigo-600 to-purple-500',
      });
    }

    items.push({
      id: 'pharmacy-stock',
      title: 'Pharmacy Sync Online',
      subtitle: `${totalStockUnits} units cataloged in stock`,
      time: 'Synced',
      icon: Pill,
      color: 'from-amber-500 to-orange-400',
    });

    items.push({
      id: 'wa-channel',
      title: 'WhatsApp Gateway Active',
      subtitle: `${onlineAppointmentsCount} digital appointments verified`,
      time: 'Ready',
      icon: MessageSquare,
      color: 'from-teal-600 to-emerald-500',
    });

    return items;
  }, [effectiveInChamber, activePatientsList, effectiveNextWaiting, totalStockUnits, onlineAppointmentsCount]);

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-4"
    >
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Today&apos;s Patients
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">
                <AnimatedCounter target={effectiveTotalCount} />
              </span>
              <span className="inline-flex items-center text-xs font-semibold text-emerald-500">
                +12% <span className="text-slate-400 font-normal text-[11px] ml-1">today</span>
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-blue-700 to-blue-500 shadow-md shadow-blue-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Completed Consults
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">
                <AnimatedCounter target={effectiveCompletedCount} />
              </span>
              <span className="inline-flex items-center text-xs font-semibold text-emerald-500">
                {completionRate}% <span className="text-slate-400 font-normal text-[11px] ml-1">rate</span>
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/25 flex items-center justify-center text-white flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Waiting in Queue
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">
                <AnimatedCounter target={effectiveWaitingCount} />
              </span>
              <span className="inline-flex items-center text-xs font-semibold text-blue-600">
                Active <span className="text-slate-400 font-normal text-[11px] ml-1">queue</span>
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-indigo-600 to-blue-500 shadow-md shadow-indigo-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Clock className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Pharmacy Stock
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800 tracking-tight">
                <AnimatedCounter target={totalStockUnits} />
              </span>
              <span className="inline-flex items-center text-xs font-semibold text-emerald-500">
                <ShieldCheck className="w-3 h-3 mr-0.5" />
                Synced <span className="text-slate-400 font-normal text-[11px] ml-1">units</span>
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-amber-500 to-orange-400 shadow-md shadow-amber-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Boxes className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>
      </motion.section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-stretch h-full">
            <div className="sm:col-span-7 flex flex-col justify-between py-1 space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  HEALTHSYNC • CLINIC OPS
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                  Smart Patient Flow &amp; Chamber Triage
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Direct token sequencing, automated WhatsApp reminders, and real-time consultation coordination with zero waiting congestion.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onRegisterWalkin}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Walk-in</span>
                </motion.button>
                <button
                  type="button"
                  onClick={onViewAllQueue}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-[#2563EB] transition cursor-pointer"
                >
                  <span>Full Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="sm:col-span-5 h-full min-h-[170px] sm:min-h-[190px] rounded-2xl overflow-hidden relative shadow-sm border border-slate-100 bg-[#EBF4FF] flex items-center justify-center">
              <img
                src="/images/medical-rocket.jpg"
                alt="HealthSync Clinical Ops"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] min-w-0 flex flex-col">
          <div
            className="relative h-full min-h-[190px] rounded-2xl overflow-hidden p-5 text-white shadow-sm border border-slate-800/20 flex flex-col items-end text-right"
            style={{
              backgroundImage: "linear-gradient(135deg, rgba(15, 23, 42, 0.35) 0%, rgba(10, 18, 38, 0.75) 100%), url('/images/doctor-telemetry-bg.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="relative z-10 flex flex-col items-end text-right space-y-1.5">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-300 drop-shadow-xs">
                CHAMBER TELEMETRY
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-white/20 border border-white/30 text-white font-bold text-xs sm:text-sm tracking-wide shadow-xs backdrop-blur-xs">
                {effectiveInChamber ? `Token ${formatPatientToken(effectiveInChamber)}` : effectiveNextWaiting ? `Token ${formatPatientToken(effectiveNextWaiting)}` : 'Token --'}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate max-w-[260px] drop-shadow-xs">
                {effectiveInChamber ? effectiveInChamber.name : effectiveNextWaiting ? effectiveNextWaiting.name : 'Waiting Lounge Clear'}
              </h3>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
          <div>
            <div className="bg-[#181F38] rounded-2xl p-4 text-white shadow-sm relative overflow-hidden">
              <div className="h-40 w-full relative">
                <svg className="w-full h-full" viewBox="0 0 360 160" preserveAspectRatio="none">
                  <text x="32" y="28" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">400</text>
                  <text x="32" y="78" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">200</text>
                  <text x="32" y="128" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">0</text>

                  <line x1="42" y1="28" x2="345" y2="28" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
                  <line x1="42" y1="78" x2="345" y2="78" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
                  <line x1="42" y1="128" x2="345" y2="128" stroke="rgba(255,255,255,0.15)" />

                  {barChartValues.map((val, i) => {
                    const x = 65 + i * 31;
                    const h = (val / 400) * 100;
                    const y = 128 - h;

                    return (
                      <motion.rect
                        key={`bar-${i}`}
                        x={x}
                        width="6"
                        rx="3"
                        fill="#FFFFFF"
                        initial={{ height: 0, y: 128 }}
                        animate={{ height: h, y: y }}
                        transition={{ duration: 0.55, delay: i * 0.05, ease: 'easeOut' }}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="text-base font-bold text-slate-800">Clinical Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-bold text-emerald-500">(+21.4%)</span> annual growth in patient consultations
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-100 mt-4">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#7928CA] to-[#FF0080] flex items-center justify-center text-white shadow-2xs">
                  <Users className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <span className="text-xs font-semibold text-slate-500">Patients</span>
              </div>
              <div className="text-lg font-bold text-slate-800 mt-1">11.8K</div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#7928CA] to-[#FF0080] rounded-full w-[65%]" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-2xs">
                  <MessageSquare className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <span className="text-xs font-semibold text-slate-500">WhatsApp</span>
              </div>
              <div className="text-lg font-bold text-slate-800 mt-1">50.3%</div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full w-[78%]" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#2152ff] to-[#21d4fd] flex items-center justify-center text-white shadow-2xs">
                  <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <span className="text-xs font-semibold text-slate-500">Avg Time</span>
              </div>
              <div className="text-lg font-bold text-slate-800 mt-1">14m</div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#2152ff] to-[#21d4fd] rounded-full w-[55%]" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#ea0606] to-[#ff667c] flex items-center justify-center text-white shadow-2xs">
                  <Pill className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <span className="text-xs font-semibold text-slate-500">Rx Stock</span>
              </div>
              <div className="text-lg font-bold text-slate-800 mt-1">{totalStockUnits || 716}</div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#ea0606] to-[#ff667c] rounded-full w-[82%]" />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-base font-bold text-slate-800">Patient Intake Overview</h3>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <span className="font-bold text-emerald-500 flex items-center">
                  ↑ +21.4%
                </span>
                <span>annual growth in clinical consultations</span>
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#17C1E8]" />
                <span>Walk-in</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                <span>WhatsApp</span>
              </div>
            </div>
          </div>

          <div className="w-full h-64 relative pt-2 pb-2">
            <svg className="w-full h-full" viewBox="0 0 650 250" preserveAspectRatio="none">
              <defs>
                <linearGradient id="softCyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#17C1E8" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#17C1E8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <text x="35" y="44" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">800</text>
              <text x="35" y="89" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">600</text>
              <text x="35" y="134" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">400</text>
              <text x="35" y="179" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">200</text>
              <text x="35" y="224" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">0</text>

              <line x1="45" y1="40" x2="630" y2="40" stroke="#EDF2F7" strokeDasharray="5 5" />
              <line x1="45" y1="85" x2="630" y2="85" stroke="#EDF2F7" strokeDasharray="5 5" />
              <line x1="45" y1="130" x2="630" y2="130" stroke="#EDF2F7" strokeDasharray="5 5" />
              <line x1="45" y1="175" x2="630" y2="175" stroke="#EDF2F7" strokeDasharray="5 5" />
              <line x1="45" y1="220" x2="630" y2="220" stroke="#EDF2F7" />

              <motion.path
                d={splineAreaPath1}
                fill="url(#softCyanAreaGrad)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />

              <motion.path
                d={splinePath1}
                fill="none"
                stroke="#17C1E8"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />

              <motion.path
                d={splinePath2}
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, delay: 0.15, ease: 'easeOut' }}
              />

              {activeTooltipIndex !== null && (
                <line
                  x1={pts1[activeTooltipIndex].x}
                  y1="40"
                  x2={pts1[activeTooltipIndex].x}
                  y2="220"
                  stroke="#E2E8F0"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )}

              {months.map((m, i) => (
                <text
                  key={m}
                  x={lineChartXCoords[i]}
                  y="242"
                  textAnchor="middle"
                  fill="#A0AEC0"
                  fontSize="11"
                  fontWeight="500"
                >
                  {m}
                </text>
              ))}

              {pts1.map((p, i) => (
                <rect
                  key={`hit-${i}`}
                  x={p.x - 25}
                  y="20"
                  width="50"
                  height="210"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActiveTooltipIndex(i)}
                />
              ))}

              {activeTooltipIndex !== null && (
                <>
                  <circle
                    cx={pts1[activeTooltipIndex].x}
                    cy={pts1[activeTooltipIndex].y}
                    r="5"
                    fill="#17C1E8"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <circle
                    cx={pts2[activeTooltipIndex].x}
                    cy={pts2[activeTooltipIndex].y}
                    r="5"
                    fill="#10B981"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                </>
              )}
            </svg>

            {activeTooltipIndex !== null && (
              <div
                className="absolute bg-[#1E293B] text-white text-[11px] rounded-xl px-3 py-2 shadow-xl border border-slate-700/50 pointer-events-none transition-all duration-150 z-20"
                style={{
                  left: `${(pts1[activeTooltipIndex].x / 650) * 100}%`,
                  top: '18px',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="font-bold text-white mb-1">{months[activeTooltipIndex]}</div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-xs bg-[#17C1E8]" />
                  <span>Walk-in: {walkinData[activeTooltipIndex]}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-xs bg-[#10B981]" />
                  <span>WhatsApp: {whatsappData[activeTooltipIndex]}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] space-y-3.5">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800">Projects</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time patient queue and consultation triage
            </p>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2.5 pl-4 sm:pl-0">Patient / Token</th>
                  <th className="pb-2.5 px-3">Type</th>
                  <th className="pb-2.5 px-3">Slot</th>
                  <th className="pb-2.5 px-3">Status</th>
                  <th className="pb-2.5 pr-4 sm:pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedQueue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No appointments in queue.
                    </td>
                  </tr>
                ) : (
                  paginatedQueue.map((p) => {
                    const isWaiting = p.status === 'Waiting';
                    const isInProgress = p.status === 'In Progress';
                    const isCompleted = p.status === 'Completed';
                    const tokenDisplay = formatPatientToken(p);
                    const isOnline =
                      Boolean(p.visitType) &&
                      (Boolean(p.visitType?.toLowerCase().includes('whatsapp')) || Boolean(p.visitType?.toLowerCase().includes('online')));

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 pl-4 sm:pl-0">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                                isInProgress
                                  ? 'bg-gradient-to-tl from-emerald-600 to-teal-400'
                                  : isCompleted
                                  ? 'bg-slate-400'
                                  : 'bg-gradient-to-tl from-blue-700 to-blue-500'
                              }`}
                            >
                              {tokenDisplay}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 block truncate max-w-[130px]">
                                {p.name}
                              </span>
                              <span className="text-[11px] text-slate-400 block">
                                {p.age}y • {p.gender}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                isOnline
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isOnline ? 'Online WA' : 'Walk-in'}
                            </span>
                            {p.priority === 'Urgent' && (
                              <span className="inline-flex items-center gap-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold px-1 py-0.5 rounded">
                                <Flame className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                                Urgent
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>{p.time}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              isInProgress
                                ? 'text-emerald-600'
                                : isCompleted
                                ? 'text-slate-400'
                                : 'text-blue-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isInProgress
                                  ? 'bg-emerald-500 animate-pulse'
                                  : isCompleted
                                  ? 'bg-slate-300'
                                  : 'bg-blue-500'
                              }`}
                            />
                            {p.status}
                          </span>
                        </td>

                        <td className="py-3 pr-4 sm:pr-0 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isWaiting && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPatientForCancel(p)}
                                  className="px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPatientForReschedule(p)}
                                  className="px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                >
                                  Reschedule
                                </button>
                              </>
                            )}

                            {isInProgress && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isLoggedIn) onStartConsultation(p.id);
                                  else onRequireLogin();
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer flex items-center gap-1"
                              >
                                <span>Resume</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {isCompleted && (
                              <span className="inline-flex items-center text-xs text-emerald-600 font-semibold">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {effectiveQueue.length > itemsPerPage && (
            <div className="pt-2 border-t border-slate-100">
              <NumberedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={effectiveQueue.length}
                itemsPerPage={itemsPerPage}
                itemName="patients"
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-bold text-slate-800">Orders overview</h3>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <span className="font-bold text-emerald-500">↑ 24%</span> this month
              </p>
            </div>

            <div className="relative pl-5 pt-4 space-y-4 before:content-[''] before:absolute before:left-[9px] before:top-5 before:bottom-2 before:w-[1.5px] before:bg-slate-100">
              {activityLog.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div key={item.id} className="relative flex items-start justify-between gap-2.5">
                    <div
                      className={`absolute -left-5 top-0.5 w-5 h-5 rounded-full bg-gradient-to-tl ${item.color} flex items-center justify-center text-white shadow-xs`}
                    >
                      <IconComponent className="w-2.5 h-2.5 stroke-[2.2]" />
                    </div>

                    <div className="min-w-0 flex-1 pl-2">
                      <h4 className="text-xs font-semibold text-slate-800 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                        {item.subtitle}
                      </p>
                    </div>

                    <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0 pt-0.5">
                      {item.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onViewAllQueue}
              className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Full Chamber Board</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#2563EB]" />
            </button>
          </div>
        </div>
      </section>

      <CancelModal
        isOpen={!!selectedPatientForCancel}
        patient={selectedPatientForCancel}
        onClose={() => setSelectedPatientForCancel(null)}
        onConfirmCancel={onCancelAppointment || (async () => {})}
      />

      <RescheduleModal
        isOpen={!!selectedPatientForReschedule}
        patient={selectedPatientForReschedule}
        queue={queue}
        onClose={() => setSelectedPatientForReschedule(null)}
        onReschedulePatient={onReschedulePatient || (async () => {})}
      />
    </motion.div>
  );
}

export default DashboardView;
