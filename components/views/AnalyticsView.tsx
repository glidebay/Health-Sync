'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  CalendarX,
  Pill,
  Search,
  X,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import { ChartLine } from '@/components/ui/chart-line';
import { RankBarChart, type RankBarItem } from '@/components/ui/rank-bars';
import { Patient } from '@/types';
import { formatPatientToken } from '@/lib/utils';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { NumberedPagination } from '@/components/ui/pagination';
import { staggerContainer, fadeScale } from '@/lib/constants';

interface AnalyticsViewProps {
  totalPatientsCount: number;
  queue?: Patient[];
  cancelledAppointments?: Patient[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

type PeriodType = 'today' | 'week' | 'month' | 'year';

const PERIOD_OPTIONS = [
  { id: 'today' as const, label: 'Today' },
  { id: 'week' as const, label: 'This Week' },
  { id: 'month' as const, label: 'This Month' },
  { id: 'year' as const, label: 'Yearly' },
];

const CANCELLED_PER_PAGE = 5;

function getInitials(name: string): string {
  if (!name) return 'PT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AnalyticsView({
  totalPatientsCount,
  queue,
  cancelledAppointments,
  searchQuery = '',
  onSearchChange,
}: AnalyticsViewProps) {
  const [internalSearch, setInternalSearch] = useState(searchQuery);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('month');
  const [cancelledPage, setCancelledPage] = useState(1);

  useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (val: string) => {
    setInternalSearch(val);
    setCancelledPage(1);
    onSearchChange?.(val);
  };

  const cancelledList = useMemo(() => {
    if (cancelledAppointments !== undefined) {
      return cancelledAppointments;
    }
    return queue ? queue.filter((p) => p.status === 'Cancelled') : [];
  }, [cancelledAppointments, queue]);

  const cancelledCount = cancelledList.length;
  const activeCount = totalPatientsCount;
  const totalBookingsToday = activeCount + cancelledCount;
  const cancellationRate =
    totalBookingsToday > 0
      ? ((cancelledCount / totalBookingsToday) * 100).toFixed(1)
      : '0.0';

  const walkinList = useMemo(() => {
    if (!queue) return [];
    return queue.filter((p) => {
      if (p.status === 'Cancelled') return false;
      const vt = (p.visitType || '').toLowerCase();
      return !vt.includes('whatsapp') && !vt.includes('online');
    });
  }, [queue]);
  const walkinCount = walkinList.length;

  const whatsappList = useMemo(() => {
    if (!queue) return [];
    return queue.filter((p) => {
      if (p.status === 'Cancelled') return false;
      const vt = (p.visitType || '').toLowerCase();
      return vt.includes('whatsapp') || vt.includes('online');
    });
  }, [queue]);
  const whatsappCount = whatsappList.length;

  const completedList = useMemo(() => {
    if (!queue) return [];
    return queue.filter((p) => p.status === 'Completed');
  }, [queue]);
  const completedCount = completedList.length;

  const todayData = [
    { time: '09 AM', walkins: 8, whatsapp: 5 },
    { time: '10 AM', walkins: 14, whatsapp: 11 },
    { time: '11 AM', walkins: 19, whatsapp: 16 },
    { time: '12 PM', walkins: 12, whatsapp: 9 },
    { time: '01 PM', walkins: 6, whatsapp: 4 },
    { time: '02 PM', walkins: 15, whatsapp: 12 },
    { time: '03 PM', walkins: 18, whatsapp: 14 },
    { time: '04 PM', walkins: 16, whatsapp: 15 },
    { time: '05 PM', walkins: 21, whatsapp: 18 },
    { time: '06 PM', walkins: 17, whatsapp: 13 },
  ];

  const weekData = [
    { time: 'Mon', walkins: 42, whatsapp: 28 },
    { time: 'Tue', walkins: 55, whatsapp: 39 },
    { time: 'Wed', walkins: 48, whatsapp: 34 },
    { time: 'Thu', walkins: 62, whatsapp: 45 },
    { time: 'Fri', walkins: 58, whatsapp: 44 },
    { time: 'Sat', walkins: 71, whatsapp: 52 },
    { time: 'Sun', walkins: 32, whatsapp: 20 },
  ];

  const monthData = [
    { time: 'Week 1', walkins: 180, whatsapp: 120 },
    { time: 'Week 2', walkins: 210, whatsapp: 155 },
    { time: 'Week 3', walkins: 195, whatsapp: 170 },
    { time: 'Week 4', walkins: 240, whatsapp: 210 },
  ];

  const yearData = [
    { time: 'Jan', walkins: 420, whatsapp: 180 },
    { time: 'Feb', walkins: 460, whatsapp: 230 },
    { time: 'Mar', walkins: 440, whatsapp: 280 },
    { time: 'Apr', walkins: 510, whatsapp: 340 },
    { time: 'May', walkins: 580, whatsapp: 410 },
    { time: 'Jun', walkins: 550, whatsapp: 430 },
    { time: 'Jul', walkins: 610, whatsapp: 490 },
    { time: 'Aug', walkins: 640, whatsapp: 530 },
    { time: 'Sep', walkins: 620, whatsapp: 570 },
    { time: 'Oct', walkins: 690, whatsapp: 640 },
    { time: 'Nov', walkins: 730, whatsapp: 710 },
    { time: 'Dec', walkins: 780, whatsapp: 790 },
  ];

  const chartMeta = useMemo(() => {
    switch (selectedPeriod) {
      case 'today':
        return {
          data: todayData,
          title: "Today's Hourly Consultation & Booking Influx",
          description: 'Live hourly breakdown of walk-in registrations vs WhatsApp appointments',
        };
      case 'week':
        return {
          data: weekData,
          title: 'Weekly Patient Traffic & Channel Distribution',
          description: 'Day-by-day comparison of Walk-ins vs WhatsApp self-service for the current week',
        };
      case 'month':
        return {
          data: monthData,
          title: 'Monthly Consultation Trajectory (By Week)',
          description: 'Weekly aggregate volume of walk-in registrations and WhatsApp reservations',
        };
      case 'year':
      default:
        return {
          data: yearData,
          title: 'Patient Footfall & Booking Channel Trends',
          description: 'Comparison of Walk-in Registrations vs WhatsApp Self-Service Appointments',
        };
    }
  }, [selectedPeriod]);

  const topSellingMedicines: RankBarItem[] = [
    {
      label: 'Paracetamol 650mg',
      sub: 'Dolo-650 · Analgesic & Antipyretic',
      value: 1420,
      highlight: true,
    },
    {
      label: 'Amoxicillin + Clav 625mg',
      sub: 'Augmentin · Broad-Spectrum Antibiotic',
      value: 1180,
    },
    {
      label: 'Pantoprazole 40mg',
      sub: 'Pan-40 · Antacid & PPI Gastro',
      value: 940,
    },
    {
      label: 'Cetirizine 10mg',
      sub: 'Cetzine · Antihistamine & Allergy',
      value: 760,
    },
    {
      label: 'Metformin 500mg',
      sub: 'Glycomet · Glycemic Control',
      value: 680,
    },
    {
      label: 'Azithromycin 500mg',
      sub: 'Azee-500 · Macrolide Antibiotic',
      value: 520,
    },
    {
      label: 'Montelukast 10mg',
      sub: 'Montair · Respiratory Care',
      value: 410,
    },
  ];

  const casesData = [
    { label: 'Viral Fever & URI', pct: '45%', color: 'bg-blue-600' },
    { label: 'Gastric & Reflux', pct: '25%', color: 'bg-blue-500' },
    { label: 'Allergies & Skin', pct: '15%', color: 'bg-blue-400' },
    { label: 'Routine Vitals', pct: '10%', color: 'bg-blue-300' },
    { label: 'Orthopedic / Joints', pct: '5%', color: 'bg-blue-200' },
  ];

  const filteredMedicines = useMemo(() => {
    const q = internalSearch.trim().toLowerCase();
    if (!q) return topSellingMedicines;
    return topSellingMedicines.filter(
      (m) => (m.label || '').toLowerCase().includes(q) || (m.sub || '').toLowerCase().includes(q)
    );
  }, [internalSearch]);

  const filteredCases = useMemo(() => {
    const q = internalSearch.trim().toLowerCase();
    if (!q) return casesData;
    return casesData.filter((c) => (c.label || '').toLowerCase().includes(q));
  }, [internalSearch]);

  const filteredCancelled = useMemo(() => {
    const q = internalSearch.trim().toLowerCase();
    if (!q) return cancelledList;
    return cancelledList.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.cancellationReason || '').toLowerCase().includes(q)
    );
  }, [internalSearch, cancelledList]);

  const totalCancelledPages = Math.max(1, Math.ceil(filteredCancelled.length / CANCELLED_PER_PAGE));

  useEffect(() => {
    if (cancelledPage > totalCancelledPages) {
      setCancelledPage(totalCancelledPages);
    }
  }, [cancelledPage, totalCancelledPages]);

  const paginatedCancelled = useMemo(() => {
    const start = (cancelledPage - 1) * CANCELLED_PER_PAGE;
    return filteredCancelled.slice(start, start + CANCELLED_PER_PAGE);
  }, [filteredCancelled, cancelledPage]);

  return (
    <motion.section
      key="analytics-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 sm:space-y-6 pb-12"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
            Clinic Analytics &amp; Practice Insights
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor patient volume trends, consultation dynamics, digital adoption, and pharmacy metrics
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-1 shadow-xs hover:border-slate-300 transition-all">
            {PERIOD_OPTIONS.map((period) => {
              const isActive = selectedPeriod === period.id;
              return (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => setSelectedPeriod(period.id)}
                  className={`relative px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer select-none ${
                    isActive ? 'text-white' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeAnalyticsPeriod"
                      className="absolute inset-0 bg-[#2563EB] rounded-xl shadow-xs"
                      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">{period.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={internalSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search analytics &amp; insights..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 shadow-2xs transition"
            />
            {internalSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 inset-y-0 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Walking Patients
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight block">
                <AnimatedCounter target={walkinCount} />
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Active</span>
            </div>
            <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
              <span>{activeCount > 0 ? `${Math.round((walkinCount / activeCount) * 100)}%` : '0%'}</span>
              <span className="text-slate-400 font-normal">of queue</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-blue-600 to-indigo-500 shadow-md shadow-blue-500/25 flex items-center justify-center text-white flex-shrink-0">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              WhatsApp Bookings
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight block">
                <AnimatedCounter target={whatsappCount} />
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Active</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
              <span>{activeCount > 0 ? `${Math.round((whatsappCount / activeCount) * 100)}%` : '0%'}</span>
              <span className="text-slate-400 font-normal">digital adoption</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-emerald-600 to-teal-500 shadow-md shadow-emerald-500/25 flex items-center justify-center text-white flex-shrink-0">
            <MessageSquare className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Completed Patients
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 tracking-tight block">
                <AnimatedCounter target={completedCount} />
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Today</span>
            </div>
            <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
              <span>{activeCount > 0 ? `${Math.round((completedCount / activeCount) * 100)}%` : '0%'}</span>
              <span className="text-slate-400 font-normal">consulted</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/25 flex items-center justify-center text-white flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -3, boxShadow: '0 20px 27px 0 rgba(0,0,0,0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl py-3.5 px-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex items-center justify-between min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Cancelled Patients
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight block">
                <AnimatedCounter target={cancelledCount} />
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Rate</span>
            </div>
            <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
              <ArrowDownRight className="w-3 h-3 flex-shrink-0" />
              <span>{cancelledCount > 0 ? `${cancellationRate}%` : '0%'}</span>
              <span className="text-slate-400 font-normal">cancellation rate</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tl from-rose-500 to-pink-500 shadow-md shadow-rose-500/25 flex items-center justify-center text-white flex-shrink-0">
            <CalendarX className="w-5 h-5 stroke-[2.2]" />
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        variants={fadeScale}
        initial="hidden"
        animate="visible"
        className="w-full"
      >
        <ChartLine
          key={selectedPeriod}
          title={chartMeta.title}
          description={chartMeta.description}
          data={chartMeta.data}
          index="time"
          series={[
            { key: 'walkins', label: 'Walk-in Patients', color: '#2563EB' },
            { key: 'whatsapp', label: 'WhatsApp Bookings', color: '#10B981' },
          ]}
          valueFormat="number"
          total="sum"
          delta="auto"
          curve="smooth"
          fill="dots"
          strokeWidth={2.5}
          height={240}
          showTooltip={true}
          showLegend={true}
          icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div
          variants={fadeScale}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">
                Top Selling &amp; Dispensed Medicines
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pharmacy dispensation leaderboard · Current monthly volume
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100/60 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-2xs">
              <Pill className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <RankBarChart
              unit=" strips"
              items={filteredMedicines}
              highlightColor="#2563EB"
            />
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.06)' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">
                Consultation Case Breakdown
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Distribution of symptoms and clinical diagnostic categories
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100/60 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-2xs">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 flex-1">
            <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#2563EB"
                  strokeWidth="14"
                  strokeDasharray="107.44 238.76"
                  strokeDashoffset="0"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth="14"
                  strokeDasharray="59.69 238.76"
                  strokeDashoffset="-107.44"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#60A5FA"
                  strokeWidth="14"
                  strokeDasharray="35.81 238.76"
                  strokeDashoffset="-167.13"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#93C5FD"
                  strokeWidth="14"
                  strokeDasharray="23.88 238.76"
                  strokeDashoffset="-202.94"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#BFDBFE"
                  strokeWidth="14"
                  strokeDasharray="11.94 238.76"
                  strokeDashoffset="-226.82"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base sm:text-lg font-bold text-slate-800">100%</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cases</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs font-medium w-full sm:w-auto">
              {filteredCases.map((item) => (
                <motion.div
                  key={item.label}
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                  className="space-y-1 cursor-default"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                      <span className="text-slate-700 font-medium">{item.label}</span>
                    </div>
                    <span className="text-slate-800 font-bold ml-4">{item.pct}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: item.pct }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full ${item.color}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={fadeScale}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <h3 className="text-base font-bold text-slate-800">
              Cancelled Appointments
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
              {cancelledCount}
            </span>
          </div>
          {cancelledCount > 0 && (
            <span className="text-xs text-slate-400 font-medium">
              {cancellationRate}% cancellation rate
            </span>
          )}
        </div>

        {cancelledCount === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-2xs border border-emerald-100/60">
              <CheckCircle2 className="w-6 h-6 stroke-[1.8]" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No cancelled appointments recorded today</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              All appointments are active or successfully fulfilled with optimal consultation throughput.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {paginatedCancelled.map((p) => {
                  const tokenDisplay = formatPatientToken(p);
                  const visitTypeDisplay =
                    p.visitType && (p.visitType.toLowerCase().includes('whatsapp') || p.visitType.toLowerCase().includes('online'))
                      ? 'Online'
                      : 'Walk-in';

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      whileHover={{ y: -1, backgroundColor: 'rgba(248, 250, 252, 0.9)' }}
                      className="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs rounded-xl transition-all border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 flex items-center justify-center font-bold text-xs text-rose-600 flex-shrink-0 shadow-2xs">
                          {getInitials(p.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="font-semibold text-xs sm:text-sm text-slate-800 truncate">
                              {p.name}
                            </span>
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60 flex-shrink-0">
                              {tokenDisplay}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {p.age}y · {p.gender}
                            </span>
                            {p.phone && (
                              <span className="text-[11px] text-slate-400 hidden md:inline">
                                · {p.phone}
                              </span>
                            )}
                          </div>
                          {p.cancellationReason && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              Reason: {p.cancellationReason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2.5 self-end sm:self-auto flex-shrink-0">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{p.time}</span>
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
                          {visitTypeDisplay}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/70">
                          Cancelled
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {totalCancelledPages > 1 && (
              <div className="pt-2 flex justify-center">
                <NumberedPagination
                  currentPage={cancelledPage}
                  totalPages={totalCancelledPages}
                  onPageChange={setCancelledPage}
                />
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}

export default AnalyticsView;
