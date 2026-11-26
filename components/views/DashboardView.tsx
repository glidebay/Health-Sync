'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { DbDoctor } from '@/types/database';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { AnimatedProgress } from '@/components/common/AnimatedProgress';
import { staggerContainer, fadeScale } from '@/lib/constants';
import { RescheduleModal, ReallocateStrategy } from '@/components/reception/RescheduleModal';
import { CancelModal } from '@/components/reception/CancelModal';
import { NumberedPagination } from '@/components/ui/pagination';
import { formatPatientToken, getTodayIST } from '@/lib/utils';
import { fetchPatientAppointmentsFromDb, fetchPavilionDashboardSummaryDb, getDoctors } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

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
  locationId?: string;
  clinicId?: string;
  branchName?: string;
  availableDoctors?: DbDoctor[];
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
  locationId,
  clinicId,
  branchName,
  availableDoctors = [],
}: DashboardViewProps) {
  const [selectedPatientForReschedule, setSelectedPatientForReschedule] = useState<Patient | null>(null);
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [doctorsPage, setDoctorsPage] = useState<number>(1);
  const [dbPatients, setDbPatients] = useState<Patient[] | null>(null);
  const [dbDoctors, setDbDoctors] = useState<DbDoctor[]>([]);
  const [pavilionSummary, setPavilionSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number>(6);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const itemsPerPage = 5;
  const doctorsPerPage = 5;

  const onQueueUpdatedRef = useRef(onQueueUpdated);
  useEffect(() => {
    onQueueUpdatedRef.current = onQueueUpdated;
  }, [onQueueUpdated]);

  const loadData = useCallback(
    async (silent: boolean = true) => {
      if (!silent) {
        setIsLoading(true);
      }
      const startTime = Date.now();
      try {
        const [fetched, summary, docs] = await Promise.all([
          fetchPatientAppointmentsFromDb({
            date: getTodayIST(),
            status: 'All',
            locationId,
            clinicId,
          }),
          fetchPavilionDashboardSummaryDb({
            clinicId,
            locationId,
          }),
          getDoctors(clinicId, locationId),
        ]);
        if (Array.isArray(fetched)) {
          setDbPatients(fetched);
          if (onQueueUpdatedRef.current) {
            onQueueUpdatedRef.current(fetched);
          }
        }
        if (summary) {
          setPavilionSummary(summary);
        }
        if (Array.isArray(docs)) {
          setDbDoctors(docs);
        }
        if (!silent) {
          const elapsed = Date.now() - startTime;
          if (elapsed < 350) {
            await new Promise((r) => setTimeout(r, 350 - elapsed));
          }
        }
      } catch (err) {
        console.warn('Dashboard live queue fetch error:', err);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [locationId, clinicId]
  );

  useEffect(() => {
    setDbPatients(null);
    setPavilionSummary(null);
    setDbDoctors([]);
    loadData(false);

    let lastSyncTime = 0;
    const handleSync = () => {
      const now = Date.now();
      // Throttle window focus refetch to at most once every 5 seconds
      if (now - lastSyncTime > 5000) {
        lastSyncTime = now;
        loadData(true);
      }
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

    // Supabase Realtime WebSocket subscription (instant updates on appointment/patient changes)
    const channelName = `realtime-dashboard-${clinicId || 'global'}-${locationId || 'global'}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        debouncedLoad();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => {
        debouncedLoad();
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
      supabase.removeChannel(channel);
    };
  }, [loadData, clinicId, locationId]);

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

  const effectiveTotalCount =
    pavilionSummary?.kpi?.today_patients ??
    (dbPatients !== null ? activePatientsList.length : totalPatientsCount);
  const effectiveWaitingCount =
    pavilionSummary?.kpi?.waiting_queue ??
    (dbPatients !== null
      ? activePatientsList.filter((p) => p.status === 'Waiting').length
      : waitingPatientsCount);
  const effectiveCompletedCount =
    pavilionSummary?.kpi?.completed_consults ??
    (dbPatients !== null
      ? activePatientsList.filter((p) => p.status === 'Completed').length
      : completedPatientsCount);
  const effectiveInChamber =
    dbPatients !== null
      ? activePatientsList.find((p) => p.status === 'In Progress')
      : inChamberPatient;
  const effectiveNextWaiting =
    dbPatients !== null
      ? activePatientsList.find((p) => p.status === 'Waiting')
      : nextWaitingPatient;
  const effectiveStockUnits =
    pavilionSummary?.kpi?.pharmacy_stock ??
    pavilionSummary?.clinical_activity?.pharmacy_stock ??
    pavilionSummary?.pharmacy_summary?.total_units ??
    totalStockUnits;

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

  // ── Left Card: Hourly Load (9 AM - 6 PM) ──
  const hourlyBars = useMemo(() => {
    const rpcBars = pavilionSummary?.clinical_activity?.bars;
    if (Array.isArray(rpcBars) && rpcBars.length > 0) {
      return rpcBars.map((b: any) => ({
        label: b.hour || `${b.hour_num || 9}`,
        shortLabel: String(b.hour || '')
          .replace(' AM', 'a')
          .replace(' PM', 'p')
          .replace(/\s+/g, ''),
        count: Number(b.count) || 0,
      }));
    }

    // Fallback computed directly from today's activePatientsList
    const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const countsByHr = new Map<number, number>();
    hours.forEach((h) => countsByHr.set(h, 0));

    activePatientsList.forEach((p) => {
      let hr = -1;
      const schedRaw = (p as any).scheduledTime;
      if (schedRaw) {
        const dt = new Date(schedRaw);
        if (!Number.isNaN(dt.getTime())) {
          const istStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            hour12: false,
          }).format(dt);
          hr = parseInt(istStr, 10);
        }
      }
      if (hr < 0 && p.time) {
        const m = p.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (m) {
          hr = parseInt(m[1], 10);
          if (m[3].toUpperCase() === 'PM' && hr < 12) hr += 12;
          if (m[3].toUpperCase() === 'AM' && hr === 12) hr = 0;
        }
      }
      if (hr >= 9 && hr <= 18) {
        countsByHr.set(hr, (countsByHr.get(hr) || 0) + 1);
      }
    });

    return hours.map((h) => ({
      label: h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
      shortLabel: h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
      count: countsByHr.get(h) || 0,
    }));
  }, [pavilionSummary, activePatientsList]);

  const barYMax = useMemo(() => {
    const rawMax = Math.max(
      Number(pavilionSummary?.clinical_activity?.max_hour_count) || 0,
      ...hourlyBars.map((b) => b.count),
      4
    );
    return Math.ceil(rawMax / 2) * 2;
  }, [pavilionSummary, hourlyBars]);

  const clinicalMetrics = useMemo(() => {
    const ca = pavilionSummary?.clinical_activity;
    const nestedMetrics = ca?.metrics;
    const todayTotal = nestedMetrics?.patients ?? ca?.today_patients ?? effectiveTotalCount;
    const dailyQuota = ca?.daily_quota ?? 40;
    const quotaPct =
      nestedMetrics?.quota_pct ??
      ca?.quota_used_pct ??
      (dailyQuota > 0 ? Math.min(100, Math.round((todayTotal / dailyQuota) * 100)) : 0);
    const whatsappPct =
      nestedMetrics?.whatsapp_pct ??
      ca?.whatsapp_rate_pct ??
      (effectiveTotalCount > 0 ? Math.round((onlineAppointmentsCount / effectiveTotalCount) * 100) : 0);
    const slotLabel =
      nestedMetrics?.avg_time ??
      ca?.avg_slot_label ??
      (ca?.slot_duration_mins ? `${ca.slot_duration_mins}m` : '15m');
    const stockUnits = nestedMetrics?.pharmacy_stock ?? ca?.pharmacy_stock ?? effectiveStockUnits;

    let subtitle = ca?.subtitle;
    if (!subtitle) {
      const peak = hourlyBars.reduce(
        (best, cur) => (cur.count > best.count ? cur : best),
        hourlyBars[0] || { label: '11 AM', count: 0 }
      );
      subtitle = `Peak: ${peak.label} (${peak.count} pts) • ${todayTotal}/${dailyQuota} daily quota (${quotaPct}%)`;
    }

    return {
      todayTotal,
      dailyQuota,
      quotaPct,
      whatsappPct,
      slotLabel,
      stockUnits,
      subtitle,
    };
  }, [pavilionSummary, effectiveTotalCount, onlineAppointmentsCount, effectiveStockUnits, hourlyBars]);

  // ── Right Card: 7-Day Daily Intake Trend (Walk-in vs WhatsApp) ──
  const intakeSeries = useMemo(() => {
    const rpcSeries = pavilionSummary?.intake_overview?.series;
    if (Array.isArray(rpcSeries) && rpcSeries.length > 0) {
      return rpcSeries.map((s: any) => ({
        day: s.day || s.month || '',
        dateStr: s.date_str || s.day || s.month || '',
        walkIn: Number(s.walk_in) || 0,
        whatsapp: Number(s.whatsapp) || 0,
      }));
    }

    // Fallback: last 7 days with today's live Walk-in / WhatsApp counts
    const todayWalkin = Math.max(0, effectiveTotalCount - onlineAppointmentsCount);
    const result = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(Date.now() - offset * 86400000);
      const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(d);
      const dateStr = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
      }).format(d);
      result.push({
        day,
        dateStr,
        walkIn: offset === 0 ? todayWalkin : 0,
        whatsapp: offset === 0 ? onlineAppointmentsCount : 0,
      });
    }
    return result;
  }, [pavilionSummary, effectiveTotalCount, onlineAppointmentsCount]);

  const intakeYMax = useMemo(() => {
    const maxVal = Math.max(
      4,
      ...intakeSeries.map((s) => Math.max(s.walkIn, s.whatsapp))
    );
    return Math.ceil(maxVal / 4) * 4;
  }, [intakeSeries]);

  const intakeSubtitle = useMemo(() => {
    if (pavilionSummary?.intake_overview?.growth_label) {
      return pavilionSummary.intake_overview.growth_label;
    }
    const todayWalkin = Math.max(0, effectiveTotalCount - onlineAppointmentsCount);
    return `Today: ${todayWalkin} Walk-in, ${onlineAppointmentsCount} WhatsApp`;
  }, [pavilionSummary, effectiveTotalCount, onlineAppointmentsCount]);

  const lineChartXCoords = useMemo(() => {
    const n = intakeSeries.length;
    if (n <= 1) return [335];
    const startX = 65;
    const endX = 605;
    return intakeSeries.map((_, i) => startX + (i * (endX - startX)) / (n - 1));
  }, [intakeSeries]);

  const safeTooltipIdx = useMemo(() => {
    if (intakeSeries.length === 0) return 0;
    return Math.min(activeTooltipIndex ?? intakeSeries.length - 1, intakeSeries.length - 1);
  }, [activeTooltipIndex, intakeSeries.length]);

  const pts1 = useMemo(() => {
    return lineChartXCoords.map((x, i) => ({
      x,
      y: 220 - ((intakeSeries[i]?.walkIn || 0) / intakeYMax) * 180,
    }));
  }, [lineChartXCoords, intakeSeries, intakeYMax]);

  const pts2 = useMemo(() => {
    return lineChartXCoords.map((x, i) => ({
      x,
      y: 220 - ((intakeSeries[i]?.whatsapp || 0) / intakeYMax) * 180,
    }));
  }, [lineChartXCoords, intakeSeries, intakeYMax]);

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
    if (!splinePath1 || pts1.length === 0) return '';
    return `${splinePath1} L ${pts1[pts1.length - 1].x.toFixed(1)} 220 L ${pts1[0].x.toFixed(1)} 220 Z`;
  }, [splinePath1, pts1]);

  const splinePath2 = useMemo(() => getCubicBezierPath(pts2), [getCubicBezierPath, pts2]);

  const branchDoctorsRoster = useMemo(() => {
    const formatDocNameAndInitials = (rawName?: string) => {
      const stripped = (rawName || 'Doctor')
        .replace(/^(?:dr\.?|doctor)\s+/gi, '')
        .replace(/^(?:dr\.?|doctor)\s+/gi, '')
        .trim();
      const displayName = `Dr. ${stripped}`;
      const initials =
        stripped
          .split(' ')
          .map((w) => w[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'DR';
      return { stripped, displayName, initials };
    };

    const rpcDoctors = pavilionSummary?.doctors_in_chamber;
    if (Array.isArray(rpcDoctors) && rpcDoctors.length > 0) {
      return rpcDoctors.map((doc) => {
        const { stripped, displayName, initials } = formatDocNameAndInitials(doc.doctor_name);
        const inProgressPatient = activePatientsList.find(
          (p) =>
            p.status === 'In Progress' &&
            ((p.doctorId && p.doctorId === doc.doctor_id) ||
              (p.doctorName && p.doctorName.toLowerCase().includes(stripped.toLowerCase())))
        );
        const waitingCount = Number(doc.waiting_count) || 0;
        const isInChamber = Boolean(doc.in_chamber || inProgressPatient);
        return {
          id: doc.doctor_id,
          displayName,
          initials,
          specialization: doc.specialization || 'General Medicine',
          isAllBranches: Boolean(doc.assigned_branch && doc.assigned_branch.toLowerCase().includes('all')),
          assignedBranchLabel: doc.assigned_branch || null,
          dailyQuota: Number(doc.daily_quota) || 30,
          inProgressPatient,
          isInChamber,
          waitingCount,
          completedCount: 0,
          totalToday: Number(doc.today_patients) || 0,
          statusLabel: doc.status_label || null,
        };
      });
    }

    const baseDocs = dbDoctors.length > 0 ? dbDoctors : availableDoctors;
    const scopedDocs = baseDocs.filter((d) => {
      if (d.is_active === false || d.is_deleted) return false;
      if (!locationId) return true;
      return !d.location_id || d.location_id === locationId || Boolean(d.is_admin_doctor);
    });

    return scopedDocs.map((doc) => {
      const { stripped, displayName, initials } = formatDocNameAndInitials(doc.full_name);

      const docPatients = activePatientsList.filter((p) => {
        if (p.doctorId && p.doctorId === doc.id) return true;
        if (p.doctorName && p.doctorName.toLowerCase().includes(stripped.toLowerCase())) return true;
        return false;
      });
      const inProgressPatient = docPatients.find((p) => p.status === 'In Progress');
      const waitingCount = docPatients.filter((p) => p.status === 'Waiting').length;
      const completedCount = docPatients.filter((p) => p.status === 'Completed').length;

      return {
        id: doc.id,
        displayName,
        initials,
        specialization: doc.specialization || 'General Medicine',
        isAllBranches: Boolean(doc.is_admin_doctor || !doc.location_id),
        assignedBranchLabel: null as string | null,
        dailyQuota: doc.daily_quota || 30,
        inProgressPatient,
        isInChamber: Boolean(inProgressPatient),
        waitingCount,
        completedCount,
        totalToday: docPatients.length,
        statusLabel: null as string | null,
      };
    });
  }, [pavilionSummary, dbDoctors, availableDoctors, locationId, activePatientsList]);

  const totalDoctorPages = Math.max(1, Math.ceil(branchDoctorsRoster.length / doctorsPerPage));

  useEffect(() => {
    if (doctorsPage > totalDoctorPages) {
      setDoctorsPage(totalDoctorPages);
    }
  }, [doctorsPage, totalDoctorPages]);

  const paginatedDoctors = useMemo(() => {
    return branchDoctorsRoster.slice((doctorsPage - 1) * doctorsPerPage, doctorsPage * doctorsPerPage);
  }, [branchDoctorsRoster, doctorsPage, doctorsPerPage]);

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-4 relative"
    >
      <EcgActionLoader isLoading={isLoading} text="Syncing branch pavilion..." />

      {/* Editorial KPI Stat Strip */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Today&apos;s Patients
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={effectiveTotalCount} />
              </span>
              <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                +12% <span className="text-slate-400 font-normal text-[11px] ml-1">today</span>
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Completed Consults
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={effectiveCompletedCount} />
              </span>
              <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                {completionRate}% <span className="text-slate-400 font-normal text-[11px] ml-1">rate</span>
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Waiting in Queue
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={effectiveWaitingCount} />
              </span>
              <span className="inline-flex items-center text-xs font-medium text-blue-600">
                Active <span className="text-slate-400 font-normal text-[11px] ml-1">queue</span>
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Pharmacy Stock
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                <AnimatedCounter target={effectiveStockUnits} />
              </span>
              <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                <ShieldCheck className="w-3 h-3 mr-0.5" />
                Synced <span className="text-slate-400 font-normal text-[11px] ml-1">units</span>
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border border-amber-100 bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Boxes className="w-4 h-4 stroke-[1.9]" />
          </div>
        </motion.div>
      </motion.section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-stretch h-full">
            <div className="sm:col-span-7 flex flex-col justify-between py-1 space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                  Clinic Operations
                </span>
                <h2 className="text-base sm:text-lg font-semibold text-[#16191E] flex items-center gap-2 flex-wrap">
                  <span>Smart Patient Flow &amp; Chamber Triage</span>
                  {branchName && (
                    <span className="rounded-full border border-blue-200/70 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                      {branchName}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Direct token sequencing, automated WhatsApp reminders, and real-time consultation coordination.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={onRegisterWalkin}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium transition shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Walk-in</span>
                </button>
                <button
                  type="button"
                  onClick={onViewAllQueue}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  <span>Full Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="sm:col-span-5 h-full min-h-[170px] sm:min-h-[190px] rounded-xl overflow-hidden relative shadow-2xs border border-slate-100 bg-[#EBF4FF] flex items-center justify-center">
              <img
                src="/images/medical-rocket.jpg"
                alt="HealthSync Clinical Ops"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs min-w-0 flex flex-col">
          <div
            className="relative h-full min-h-[190px] rounded-xl overflow-hidden p-5 text-white shadow-2xs border border-slate-800/20 flex flex-col items-end text-right"
            style={{
              backgroundImage: "linear-gradient(135deg, rgba(15, 23, 42, 0.35) 0%, rgba(10, 18, 38, 0.75) 100%), url('/images/doctor-telemetry-bg.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="relative z-10 flex flex-col items-end text-right space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-blue-200">
                Chamber Telemetry
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white font-medium text-xs backdrop-blur-xs">
                {pavilionSummary?.telemetry?.active_token
                  ? `Token ${pavilionSummary.telemetry.active_token}`
                  : effectiveInChamber
                    ? `Token ${formatPatientToken(effectiveInChamber)}`
                    : effectiveNextWaiting
                      ? `Token ${formatPatientToken(effectiveNextWaiting)}`
                      : 'Token --'}
              </span>
              <h3 className="text-base sm:text-lg font-semibold text-white truncate max-w-[260px]">
                {effectiveInChamber
                  ? effectiveInChamber.name
                  : effectiveNextWaiting
                    ? effectiveNextWaiting.name
                    : pavilionSummary?.telemetry?.lounge_status || 'Waiting Lounge Clear'}
              </h3>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0">
          <div>
            <div className="bg-[#181F38] rounded-xl p-4 text-white shadow-xs relative overflow-hidden">
              {hoveredBarIndex !== null && hourlyBars[hoveredBarIndex] && (
                <div className="absolute top-2.5 right-3 z-10 bg-slate-900/90 border border-slate-700/70 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
                  {hourlyBars[hoveredBarIndex].label}:{' '}
                  <span className="text-sky-400 font-bold">
                    {hourlyBars[hoveredBarIndex].count} {hourlyBars[hoveredBarIndex].count === 1 ? 'patient' : 'patients'}
                  </span>
                </div>
              )}
              <div className="h-44 w-full relative">
                <svg className="w-full h-full" viewBox="0 0 360 165" preserveAspectRatio="none">
                  <text x="32" y="28" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">{barYMax}</text>
                  <text x="32" y="78" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">{Math.round(barYMax / 2)}</text>
                  <text x="32" y="128" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">0</text>

                  <line x1="42" y1="28" x2="348" y2="28" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
                  <line x1="42" y1="78" x2="348" y2="78" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
                  <line x1="42" y1="128" x2="348" y2="128" stroke="rgba(255,255,255,0.15)" />

                  {hourlyBars.map((bar, i) => {
                    const step = hourlyBars.length > 1 ? 286 / (hourlyBars.length - 1) : 0;
                    const x = 52 + i * step;
                    const h = bar.count > 0 ? Math.max(8, (bar.count / barYMax) * 100) : 6;
                    const y = 128 - h;
                    const isHovered = hoveredBarIndex === i;

                    return (
                      <g
                        key={`bar-${bar.label}-${i}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredBarIndex(i)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        <rect
                          x={x - 10}
                          y={20}
                          width="26"
                          height="125"
                          fill="transparent"
                        />
                        <motion.rect
                          x={x}
                          width="7"
                          rx="3.5"
                          fill={isHovered ? '#38BDF8' : bar.count > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.22)'}
                          initial={{ height: 0, y: 128 }}
                          animate={{ height: h, y: y }}
                          transition={{ duration: 0.45, delay: i * 0.04, ease: 'easeOut' }}
                        />
                        <text
                          x={x + 3.5}
                          y="148"
                          textAnchor="middle"
                          fill={isHovered ? '#38BDF8' : '#94A3B8'}
                          fontSize="9.5"
                          fontWeight={isHovered ? '700' : '500'}
                        >
                          {bar.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="text-sm sm:text-base font-bold text-[#16191E]">Clinical Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {clinicalMetrics.subtitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-100 mt-4">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#7928CA] to-[#FF0080] flex items-center justify-center text-white shadow-2xs">
                  <Users className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-slate-500">Patients</span>
              </div>
              <div className="text-base font-bold text-[#16191E] mt-1">{clinicalMetrics.todayTotal}</div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#7928CA] to-[#FF0080] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(8, clinicalMetrics.quotaPct))}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-2xs">
                  <MessageSquare className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-slate-500">WhatsApp</span>
              </div>
              <div className="text-base font-bold text-[#16191E] mt-1">{clinicalMetrics.whatsappPct}%</div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(8, clinicalMetrics.whatsappPct))}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#2152ff] to-[#21d4fd] flex items-center justify-center text-white shadow-2xs">
                  <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-slate-500">Slot Time</span>
              </div>
              <div className="text-base font-bold text-[#16191E] mt-1">{clinicalMetrics.slotLabel}</div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2152ff] to-[#21d4fd] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(15, completionRate || 50))}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#ea0606] to-[#ff667c] flex items-center justify-center text-white shadow-2xs">
                  <Pill className="w-2.5 h-2.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-slate-500">Rx Stock</span>
              </div>
              <div className="text-base font-bold text-[#16191E] mt-1">{clinicalMetrics.stockUnits}</div>
              <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#ea0606] to-[#ff667c] rounded-full transition-all duration-300"
                  style={{ width: clinicalMetrics.stockUnits > 0 ? '82%' : '12%' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#16191E]">Patient Intake Overview</h3>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <span className="font-bold text-emerald-600">{intakeSubtitle}</span>
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

              <text x="35" y="44" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">{intakeYMax}</text>
              <text x="35" y="89" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">{Math.round(intakeYMax * 0.75)}</text>
              <text x="35" y="134" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">{Math.round(intakeYMax * 0.5)}</text>
              <text x="35" y="179" textAnchor="end" fill="#A0AEC0" fontSize="11" fontWeight="500">{Math.round(intakeYMax * 0.25)}</text>
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

              {pts1[safeTooltipIdx] && (
                <line
                  x1={pts1[safeTooltipIdx].x}
                  y1="40"
                  x2={pts1[safeTooltipIdx].x}
                  y2="220"
                  stroke="#E2E8F0"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )}

              {intakeSeries.map((item, i) => (
                <text
                  key={`${item.day}-${i}`}
                  x={lineChartXCoords[i]}
                  y="242"
                  textAnchor="middle"
                  fill="#A0AEC0"
                  fontSize="11"
                  fontWeight="500"
                >
                  {item.day}
                </text>
              ))}

              {pts1.map((p, i) => (
                <rect
                  key={`hit-${i}`}
                  x={p.x - 32}
                  y="20"
                  width="64"
                  height="210"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActiveTooltipIndex(i)}
                />
              ))}

              {pts1[safeTooltipIdx] && pts2[safeTooltipIdx] && (
                <>
                  <circle
                    cx={pts1[safeTooltipIdx].x}
                    cy={pts1[safeTooltipIdx].y}
                    r="5"
                    fill="#17C1E8"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <circle
                    cx={pts2[safeTooltipIdx].x}
                    cy={pts2[safeTooltipIdx].y}
                    r="5"
                    fill="#10B981"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                </>
              )}
            </svg>

            {intakeSeries[safeTooltipIdx] && pts1[safeTooltipIdx] && (
              <div
                className="absolute bg-[#1E293B] text-white text-[11px] rounded-xl px-3 py-2 shadow-xl border border-slate-700/50 pointer-events-none transition-all duration-150 z-20"
                style={{
                  left: `${(pts1[safeTooltipIdx].x / 650) * 100}%`,
                  top: '18px',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="font-bold text-white mb-1">
                  {intakeSeries[safeTooltipIdx].day} ({intakeSeries[safeTooltipIdx].dateStr})
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-xs bg-[#17C1E8]" />
                  <span>Walk-in: {intakeSeries[safeTooltipIdx].walkIn}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-xs bg-[#10B981]" />
                  <span>WhatsApp: {intakeSeries[safeTooltipIdx].whatsapp}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                Live Roster • {effectiveQueue.length} {effectiveQueue.length === 1 ? 'Patient' : 'Patients'}
              </span>
              <h3 className="mt-1 text-base font-semibold text-[#16191E]">Patient Queue</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Today&apos;s waiting and active consultation sequence.
              </p>
            </div>
          </div>

          {paginatedQueue.length === 0 ? (
            <div className="border-y border-slate-200/80 py-10 text-center text-xs text-slate-400">
              No appointments in queue.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
              {paginatedQueue.map((p, index) => {
                const isWaiting = p.status === 'Waiting';
                const isInProgress = p.status === 'In Progress';
                const isCompleted = p.status === 'Completed';
                const tokenDisplay = formatPatientToken(p);
                const rowNumber = String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0');
                const isOnline =
                  Boolean(p.visitType) &&
                  (Boolean(p.visitType?.toLowerCase().includes('whatsapp')) || Boolean(p.visitType?.toLowerCase().includes('online')));

                return (
                  <li key={p.id}>
                    <div
                      className={`grid grid-cols-1 gap-3 py-4 sm:grid-cols-[2rem_1fr_auto] sm:gap-5 items-start sm:items-center ${
                        isCompleted ? 'opacity-55' : ''
                      }`}
                    >
                      <span className="text-xs font-medium text-slate-400 tabular-nums sm:pt-0.5">
                        {rowNumber}
                      </span>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-[#16191E] truncate">
                            {p.name}
                          </h4>
                          <span className="text-xs text-slate-500">
                            Token {tokenDisplay} • Slot: {p.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                          <span className="text-slate-500 mr-1">
                            {p.age} yrs, {p.gender}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-slate-600">
                            {isOnline ? 'Online (WhatsApp)' : 'Walk-in'}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-medium ${
                              isInProgress
                                ? 'bg-emerald-50 text-emerald-700'
                                : isCompleted
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {p.status}
                          </span>
                          {p.priority === 'Urgent' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/70 px-2.5 py-0.5 font-medium">
                              <Flame className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                              Urgent
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 sm:col-start-3">
                        {isWaiting && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedPatientForCancel(p)}
                              className="rounded-full border border-rose-200/80 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPatientForReschedule(p)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-colors cursor-pointer"
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
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] hover:bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
                          >
                            <span>Resume Consult</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                            <Check className="w-3 h-3" />
                            Done
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {effectiveQueue.length > itemsPerPage && (
            <div className="pt-2">
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

        <div className="lg:col-span-4 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0 space-y-5">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                  Physician Roster
                </span>
                <h3 className="mt-1 text-base font-semibold text-[#16191E]">Doctors in Chamber</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {branchName ? `Active at ${branchName}` : 'Active clinic roster'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200 flex-shrink-0">
                <Stethoscope className="w-3 h-3 text-slate-500" />
                <span>{branchDoctorsRoster.length}</span>
              </span>
            </div>

            {branchDoctorsRoster.length === 0 ? (
              <div className="py-10 border-y border-slate-200/80 text-center">
                <Stethoscope className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No doctors assigned yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Add doctors for this branch in Doctor Management.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                {paginatedDoctors.map((doc) => {
                  const isConsulting = Boolean(doc.isInChamber || doc.inProgressPatient);
                  return (
                    <li
                      key={doc.id}
                      className="py-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 relative border ${
                            isConsulting
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {doc.initials}
                          {isConsulting && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-medium text-[#16191E] truncate">
                            {doc.displayName}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {doc.specialization}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {isConsulting ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                            {doc.inProgressPatient
                              ? `Chamber • ${formatPatientToken(doc.inProgressPatient)}`
                              : doc.statusLabel || 'In Chamber'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                            {doc.statusLabel ||
                              (doc.waitingCount > 0
                                ? `${doc.waitingCount} waiting`
                                : 'Available')}
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1 tabular-nums">
                          {doc.totalToday}/{doc.dailyQuota} today
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {branchDoctorsRoster.length > doctorsPerPage && (
              <div className="pt-1">
                <NumberedPagination
                  currentPage={doctorsPage}
                  totalPages={totalDoctorPages}
                  onPageChange={setDoctorsPage}
                  totalItems={branchDoctorsRoster.length}
                  itemsPerPage={doctorsPerPage}
                  itemName="doctors"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onViewAllQueue}
            className="w-full py-2.5 px-4 rounded-full border border-slate-200 bg-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] text-slate-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>View Full Chamber Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      <CancelModal
        isOpen={!!selectedPatientForCancel}
        patient={selectedPatientForCancel}
        onClose={() => setSelectedPatientForCancel(null)}
        onConfirmCancel={onCancelAppointment || (async () => { })}
      />

      <RescheduleModal
        isOpen={!!selectedPatientForReschedule}
        patient={selectedPatientForReschedule}
        queue={queue}
        onClose={() => setSelectedPatientForReschedule(null)}
        onReschedulePatient={onReschedulePatient || (async () => { })}
      />
    </motion.div>
  );
}

export default DashboardView;
