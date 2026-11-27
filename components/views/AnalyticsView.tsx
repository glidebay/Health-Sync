'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Chart, { ChartConfiguration, ChartType, Plugin, ScriptableContext } from 'chart.js/auto';
import {
  Users,
  Clock,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertCircle,
  Sparkles,
  Calendar,
  Activity,
  Building2,
  Pill,
  IndianRupee,
  Boxes,
  RefreshCw,
  Stethoscope,
  UserPlus,
  CalendarX,
  UserX,
  Link2,
  Gauge,
  X,
} from 'lucide-react';
import { Patient } from '@/types';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { NumberedPagination } from '@/components/ui/pagination';
import { staggerContainer, fadeScale } from '@/lib/constants';
import { fetchFullAnalyticsDashboardDb } from '@/lib/supabaseService';
import { supabase } from '@/lib/supabaseClient';
import { getTodayIST } from '@/lib/utils';
import { EcgActionLoader } from '@/components/loading/EcgActionLoader';

interface AnalyticsViewProps {
  totalPatientsCount: number;
  queue?: Patient[];
  cancelledAppointments?: Patient[];
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  locationId?: string;
  clinicId?: string;
  branchName?: string;
}

type AnalyticsTab = 'footfall' | 'clinical' | 'queue' | 'doctors';
type PeriodDays = 7 | 30 | 180;

interface SelectOption {
  id: string;
  name: string;
}

interface DoctorOption extends SelectOption {
  dailyQuota: number;
}

interface NormalizedAppointment {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  branchId: string;
  doctorId: string;
  status: string;
  isCompleted: boolean;
  isCancelled: boolean;
  isNoShow: boolean;
  cancellationReason: string | null;
  channel: 'walkin' | 'whatsapp';
  year: number;
  month: number;
  day: number;
  monthKey: string;
  dateKey: string;
  hour: number | null;
  durationMins: number | null;
  durationSource: 'measured' | 'recorded' | null;
  diagnosis: string | null;
  isLate: boolean;
}

interface PharmacySaleEvent {
  dateKey: string;
  branchId: string;
  doctorId: string;
  molecule: string;
  qty: number;
  revenue: number | null;
  cost: number | null;
}

interface PharmacyStockRow {
  branchId: string;
  molecule: string;
  unitsOnHand: number;
  stockValue: number | null;
}

interface WaLinkRecord {
  dateKey: string;
  branchId: string;
  booked: boolean;
}

interface LeaveRecord {
  dateKey: string;
  doctorId: string;
  doctorName: string;
  type: string;
  upcoming: boolean;
}

interface MonthlyBucket {
  monthKey: string;
  shortLabel: string;
  fullLabel: string;
  walkin: number;
  whatsapp: number;
  total: number;
  whatsappSharePct: number;
  momGrowthPct: number | null;
}

interface HourlyBucket {
  hour: number;
  label: string;
  shortLabel: string;
  walkin: number;
  whatsapp: number;
  total: number;
}

const PERIOD_OPTIONS: Array<{ id: PeriodDays; label: string }> = [
  { id: 7, label: 'Last 7 Days' },
  { id: 30, label: 'Last 30 Days' },
  { id: 180, label: 'Last 6 Months' },
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SERIES_PALETTE = ['#2563EB', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6', '#94A3B8'];
const CANCEL_PALETTE = ['#F43F5E', '#FB7185', '#F59E0B', '#6366F1', '#8B5CF6', '#94A3B8'];
const DAY_MS = 86_400_000;
const DOCTOR_TABLE_PAGE_SIZE = 5;

function getPaginatedSlice<T>(rows: T[], currentPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    currentPage: safePage,
    totalPages,
    startIndex: rows.length === 0 ? 0 : start + 1,
    endIndex: Math.min(start + pageSize, rows.length),
  };
}

function DoctorTablePagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  itemName,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemName: string;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= DOCTOR_TABLE_PAGE_SIZE) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3 border-t border-slate-100">
      <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
        Showing {startIndex}–{endIndex} of {totalItems} {itemName}
      </span>
      <NumberedPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={DOCTOR_TABLE_PAGE_SIZE}
        itemName={itemName}
        onPageChange={onPageChange}
        className="mt-0 pt-0 border-t-0 w-auto sm:mx-0 justify-end"
      />
    </div>
  );
}

function formatMonthKey(year: number, month1To12: number): string {
  return `${year}-${String(month1To12).padStart(2, '0')}`;
}

function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatHoursMins(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatCompactBranchHeader(name: string, allNames: string[]): string {
  const splitParts = allNames.map((n) => {
    const idx = n.search(/\s[-–—]\s/);
    return idx > 0 ? { prefix: n.slice(0, idx).trim().toLowerCase(), short: n.slice(idx + 3).trim() } : null;
  });
  const firstPrefix = splitParts[0]?.prefix;
  if (firstPrefix && splitParts.every((p) => p && p.prefix === firstPrefix && p.short.length > 0)) {
    const idx = name.search(/\s[-–—]\s/);
    if (idx > 0) return name.slice(idx + 3).trim();
  }
  return name;
}

function ageInDays(anchorYmd: string, targetYmd: string): number {
  const a = Date.parse(`${anchorYmd}T00:00:00Z`);
  const b = Date.parse(`${targetYmd}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 9999;
  return Math.round((a - b) / DAY_MS);
}

function shiftDateYmd(anchorYmd: string, deltaDays: number): string {
  const ms = Date.parse(`${anchorYmd}T00:00:00Z`);
  if (Number.isNaN(ms)) return anchorYmd;
  return new Date(ms + deltaDays * DAY_MS).toISOString().slice(0, 10);
}

function getTrailingMonths(
  anchorYmd: string,
  count: number
): Array<{ year: number; month: number; monthKey: string; shortLabel: string; fullLabel: string }> {
  const [yStr, mStr] = anchorYmd.split('-');
  const anchorYear = Number(yStr) || new Date().getFullYear();
  const anchorMonth = Number(mStr) || new Date().getMonth() + 1;

  const list: Array<{ year: number; month: number; monthKey: string; shortLabel: string; fullLabel: string }> = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const d = new Date(Date.UTC(anchorYear, anchorMonth - 1 - offset, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const monthName = MONTH_SHORT[m - 1] || 'M';
    list.push({
      year: y,
      month: m,
      monthKey: formatMonthKey(y, m),
      shortLabel: monthName,
      fullLabel: `${monthName} ${y}`,
    });
  }
  return list;
}

function getSixMonthsStartIso(anchorYmd: string): string {
  const [yStr, mStr] = anchorYmd.split('-');
  const anchorYear = Number(yStr) || new Date().getFullYear();
  const anchorMonth = Number(mStr) || new Date().getMonth() + 1;
  const start = new Date(Date.UTC(anchorYear, anchorMonth - 6, 1));
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01T00:00:00+05:30`;
}

function parseISTDateAndHour(isoStr?: string | null): { year: number; month: number; day: number; hour: number | null } | null {
  if (!isoStr) return null;
  const dateObj = new Date(isoStr);
  if (Number.isNaN(dateObj.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(dateObj);

    const getPart = (t: string) => parts.find((p) => p.type === t)?.value || '';
    const year = Number(getPart('year'));
    const month = Number(getPart('month'));
    const day = Number(getPart('day'));
    let hour = Number(getPart('hour'));
    if (hour === 24) hour = 0;

    if (!year || !month || !day) return null;
    return { year, month, day, hour: Number.isFinite(hour) ? hour : null };
  } catch {
    return null;
  }
}

function parseSlotTimeHour(slotStr?: string): number | null {
  if (!slotStr) return null;
  const match = slotStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour >= 0 && hour <= 23 ? hour : null;
}

function formatHourLabel(hour: number, compact = false): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return compact ? '12a' : '12 AM';
  if (h < 12) return compact ? `${h}a` : `${h} AM`;
  if (h === 12) return compact ? '12p' : '12 PM';
  return compact ? `${h - 12}p` : `${h - 12} PM`;
}

function isWhatsAppChannel(rawVisitType?: string | null, rawBookingChannel?: string | null): boolean {
  const combined = `${rawVisitType || ''} ${rawBookingChannel || ''}`.toLowerCase();
  return combined.includes('whatsapp') || combined.includes('online');
}

function classifyDiagnosis(notes?: string | null): string | null {
  const clean = (notes || '').trim().toLowerCase();
  if (!clean) return null;
  if (/(fever|cold|cough|uri|flu|throat|viral|asthma|respiratory|sinus|bronch)/.test(clean)) {
    return 'Viral / Respiratory';
  }
  if (/(diabetes|sugar|thyroid|hba1c|insulin|metformin|endocrine|glycem)/.test(clean)) {
    return 'Endocrine / Diabetes';
  }
  if (/(hypertension|bp|cardiac|heart|cholest|ecg|amlodipine|cardio)/.test(clean)) {
    return 'Cardiovascular';
  }
  if (/(gastric|acidity|pain|abdom|ulcer|diarrhea|reflux|gerd|stomach)/.test(clean)) {
    return 'Gastrointestinal';
  }
  return 'General Consultation';
}

const barValuesPlugin: Plugin<'bar'> = {
  id: 'barValues',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    if ((data.labels?.length ?? 0) * data.datasets.length > 24) return;
    const isHorizontal = chart.options.indexAxis === 'y';
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = isHorizontal ? 'left' : 'center';
    ctx.textBaseline = isHorizontal ? 'middle' : 'bottom';
    data.datasets.forEach((set, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      meta.data.forEach((bar, j) => {
        const val = Number(set.data[j]);
        if (!Number.isFinite(val) || val === 0) return;
        const text = val.toLocaleString('en-IN', { maximumFractionDigits: 1 });
        ctx.fillText(text, bar.x + (isHorizontal ? 6 : 0), bar.y - (isHorizontal ? 0 : 4));
      });
    });
    ctx.restore();
  },
};

function ChartCanvas<T extends ChartType>({
  type,
  data,
  options,
  showValues = false,
}: {
  type: T;
  data: ChartConfiguration<T>['data'];
  options: ChartConfiguration<T>['options'];
  showValues?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<T> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const plugins = showValues && type === 'bar' ? [barValuesPlugin as unknown as Plugin<T>] : [];
    chartRef.current = new Chart(canvas, {
      type,
      data,
      options,
      plugins,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [type, data, options, showValues]);

  return <canvas ref={canvasRef} />;
}

function buildSampleDataset(anchorYmd: string): {
  branches: SelectOption[];
  doctors: DoctorOption[];
  appointments: NormalizedAppointment[];
  sales: PharmacySaleEvent[];
  stock: PharmacyStockRow[];
  waLinks: WaLinkRecord[];
  leaves: LeaveRecord[];
} {
  const branches: SelectOption[] = [
    { id: 'sample-b1', name: 'Main Clinic Branch' },
    { id: 'sample-b2', name: 'City Center Annex' },
  ];
  const doctors: DoctorOption[] = [
    { id: 'sample-d1', name: 'Dr. Ananya Ramesh', dailyQuota: 28 },
    { id: 'sample-d2', name: 'Dr. Karthik Menon', dailyQuota: 22 },
  ];

  const leaves: LeaveRecord[] = [
    { dateKey: shiftDateYmd(anchorYmd, -3), doctorId: 'sample-d1', doctorName: 'Dr. Ananya Ramesh', type: 'Casual', upcoming: false },
    { dateKey: shiftDateYmd(anchorYmd, -14), doctorId: 'sample-d2', doctorName: 'Dr. Karthik Menon', type: 'Sick', upcoming: false },
    { dateKey: shiftDateYmd(anchorYmd, 7), doctorId: 'sample-d1', doctorName: 'Dr. Ananya Ramesh', type: 'Planned', upcoming: true },
  ];

  const months = getTrailingMonths(anchorYmd, 6);
  const distribution = [
    { walkin: 92, whatsapp: 38, duration: 14 },
    { walkin: 104, whatsapp: 52, duration: 13 },
    { walkin: 98, whatsapp: 64, duration: 14 },
    { walkin: 112, whatsapp: 79, duration: 12 },
    { walkin: 118, whatsapp: 94, duration: 13 },
    { walkin: 124, whatsapp: 116, duration: 12 },
  ];
  const hourWeights = [
    { hour: 9, weight: 8 },
    { hour: 10, weight: 14 },
    { hour: 11, weight: 18 },
    { hour: 12, weight: 11 },
    { hour: 13, weight: 4 },
    { hour: 14, weight: 7 },
    { hour: 15, weight: 10 },
    { hour: 16, weight: 13 },
    { hour: 17, weight: 16 },
    { hour: 18, weight: 12 },
    { hour: 19, weight: 6 },
  ];
  const totalWeight = hourWeights.reduce((acc, item) => acc + item.weight, 0);
  const pickHour = (idx: number) => {
    let cursor = idx % totalWeight;
    for (const hw of hourWeights) {
      if (cursor < hw.weight) return hw.hour;
      cursor -= hw.weight;
    }
    return 11;
  };

  const diagnoses = [
    'Viral / Respiratory',
    'Endocrine / Diabetes',
    'Cardiovascular',
    'Gastrointestinal',
    'General Consultation',
  ];
  const cancelReasons = ['Personal Schedule', 'Doctor Delayed', 'Recovered', 'Rescheduled', 'Other'];
  const meds = [
    { name: 'Paracetamol 650mg', price: 24, cost: 16, stockVal: 18400 },
    { name: 'Amoxicillin + Clav 625mg', price: 95, cost: 64, stockVal: 26800 },
    { name: 'Pantoprazole 40mg', price: 52, cost: 34, stockVal: 14200 },
    { name: 'Metformin 500mg', price: 38, cost: 25, stockVal: 19500 },
    { name: 'Cetirizine 10mg', price: 18, cost: 11, stockVal: 9600 },
  ];

  const appointments: NormalizedAppointment[] = [];
  const sales: PharmacySaleEvent[] = [];
  const waLinks: WaLinkRecord[] = [];
  const [, , dStr] = anchorYmd.split('-');
  const todayDay = Number(dStr) || 15;

  months.forEach((mInfo, mIdx) => {
    const cfg = distribution[mIdx] || distribution[distribution.length - 1];
    const totalInMonth = cfg.walkin + cfg.whatsapp;
    for (let i = 0; i < totalInMonth; i++) {
      const isWa = i >= cfg.walkin;
      const dayNum = mIdx === months.length - 1 ? Math.max(1, todayDay - (i % 14)) : (i % 27) + 1;
      const dateKey = `${mInfo.monthKey}-${String(dayNum).padStart(2, '0')}`;
      const branchId = i % 5 < 3 ? branches[0].id : branches[1].id;
      const doctorId = i % 2 === 0 ? doctors[0].id : doctors[1].id;
      const isCancelled = i % 19 === 4;
      const isNoShow = !isCancelled && i % 23 === 7;
      const isCompleted = !isCancelled && !isNoShow;

      appointments.push({
        id: `sample-${mInfo.monthKey}-${i}`,
        patientId: `sample-pt-${i % 140}`,
        patientName: `Sample Patient ${i + 1}`,
        phone: '',
        branchId,
        doctorId,
        status: isCancelled ? 'Cancelled' : isNoShow ? 'Waiting' : 'Completed',
        isCompleted,
        isCancelled,
        isNoShow,
        cancellationReason: isCancelled ? cancelReasons[i % cancelReasons.length] : null,
        channel: isWa ? 'whatsapp' : 'walkin',
        year: mInfo.year,
        month: mInfo.month,
        day: dayNum,
        monthKey: mInfo.monthKey,
        dateKey,
        hour: pickHour(i + mIdx * 3),
        durationMins: isCompleted ? cfg.duration + (i % 3 === 0 ? 2 : i % 3 === 1 ? -1 : 0) : null,
        durationSource: isCompleted ? 'measured' : null,
        diagnosis: isCompleted ? diagnoses[i % diagnoses.length] : null,
        isLate: isCompleted && i % 9 === 2,
      });

      if (isWa) {
        waLinks.push({ dateKey, branchId, booked: i % 4 !== 0 });
      }

      if (isCompleted) {
        const med = meds[(i + mIdx) % meds.length];
        const qty = 2 + (i % 4);
        sales.push({
          dateKey,
          branchId,
          doctorId,
          molecule: med.name,
          qty,
          revenue: qty * med.price,
          cost: qty * med.cost,
        });
      }
    }
  });

  const stock: PharmacyStockRow[] = branches.flatMap((b, bi) =>
    meds.map((m) => ({
      branchId: b.id,
      molecule: m.name,
      unitsOnHand: bi === 0 ? 420 : 280,
      stockValue: Math.round(m.stockVal * (bi === 0 ? 1.15 : 0.85)),
    }))
  );

  return { branches, doctors, appointments, sales, stock, waLinks, leaves };
}

export function AnalyticsView({
  totalPatientsCount,
  queue,
  cancelledAppointments,
  searchQuery = '',
  locationId,
  clinicId,
  branchName,
}: AnalyticsViewProps) {
  const cleanQuery = searchQuery.trim().toLowerCase();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('footfall');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodDays>(30);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  const [branches, setBranches] = useState<SelectOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [dbAppointments, setDbAppointments] = useState<NormalizedAppointment[]>([]);
  const [dbSales, setDbSales] = useState<PharmacySaleEvent[]>([]);
  const [dbStock, setDbStock] = useState<PharmacyStockRow[]>([]);
  const [dbWaLinks, setDbWaLinks] = useState<WaLinkRecord[]>([]);
  const [dbLeaves, setDbLeaves] = useState<LeaveRecord[]>([]);
  const [rpcAvgDuration, setRpcAvgDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showSamplePreview, setShowSamplePreview] = useState<boolean>(false);
  const [doctorSummaryPage, setDoctorSummaryPage] = useState<number>(1);
  const [doctorDailyPage, setDoctorDailyPage] = useState<number>(1);
  const [doctorLeavesPage, setDoctorLeavesPage] = useState<number>(1);
  const [doctorQuotaPage, setDoctorQuotaPage] = useState<number>(1);
  const [overviewDateFilter, setOverviewDateFilter] = useState<string>('');
  const [overviewDoctorId, setOverviewDoctorId] = useState<string>('');

  const resetDoctorPages = () => {
    setDoctorSummaryPage(1);
    setDoctorDailyPage(1);
    setDoctorLeavesPage(1);
    setDoctorQuotaPage(1);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    window.scrollTo(0, 0);
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.scrollY > 0 || window.scrollX > 0)) {
      window.scrollTo(0, 0);
    }
  }, [activeTab]);

  const todayIST = useMemo(() => getTodayIST(), []);

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    const sixMonthsStartIso = getSixMonthsStartIso(todayIST);

    const loadAllAnalyticsData = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      setIsLoading(true);
      setFetchError(null);

      try {
        let locQuery = supabase
          .from('clinic_locations')
          .select('id, branch_name, clinic_id, is_active')
          .neq('is_active', false);
        if (clinicId) {
          locQuery = locQuery.eq('clinic_id', clinicId);
        } else if (locationId) {
          locQuery = locQuery.eq('id', locationId);
        }

        let docQuery = supabase
          .from('doctors')
          .select('id, full_name, daily_quota, clinic_id, location_id')
          .neq('is_deleted', true);
        if (clinicId) {
          docQuery = docQuery.eq('clinic_id', clinicId);
        } else if (locationId) {
          docQuery = docQuery.eq('location_id', locationId);
        }

        let apptQuery = supabase
          .from('appointments')
          .select('*')
          .gte('scheduled_time', sixMonthsStartIso)
          .order('scheduled_time', { ascending: true })
          .limit(5000);
        if (clinicId) {
          apptQuery = apptQuery.eq('clinic_id', clinicId);
        } else if (locationId) {
          apptQuery = apptQuery.eq('location_id', locationId);
        }

        let waQuery = supabase
          .from('whatsapp_requests')
          .select('*')
          .gte('created_at', sixMonthsStartIso)
          .limit(3000);
        if (locationId) {
          waQuery = waQuery.eq('location_id', locationId);
        }

        const [
          locRes,
          docRes,
          apptRes,
          rpcRes,
          rxRes,
          invRes,
          medRes,
          batchRes,
          movRes,
          logsRes,
          waRes,
        ] = await Promise.allSettled([
          locQuery,
          docQuery,
          apptQuery,
          fetchFullAnalyticsDashboardDb({ clinicId, locationId }),
          supabase.from('prescribed_medications').select('appointment_id, inventory_id, dispensed_quantity, medicine_name, created_at').limit(5000),
          supabase.from('inventory').select('*').limit(2000),
          supabase.from('medicines').select('id, brand_name, generic_name, clinic_id').limit(2000),
          supabase.from('medicine_batches').select('id, medicine_id, available_quantity, purchase_price, selling_price, clinic_id, location_id').limit(3000),
          supabase
            .from('stock_movements')
            .select('medicine_id, batch_id, movement_type, quantity, date')
            .eq('movement_type', 'Dispensing')
            .gte('date', sixMonthsStartIso)
            .limit(5000),
          supabase.from('appointment_logs').select('appointment_id, reason, action, logged_at').limit(3000),
          waQuery,
        ]);

        if (!isMounted) return;

        if (locRes.status === 'fulfilled' && !locRes.value.error && Array.isArray(locRes.value.data)) {
          setBranches(
            locRes.value.data.map((b: Record<string, unknown>) => ({
              id: String(b.id),
              name: String(b.branch_name || 'Main Branch'),
            }))
          );
        } else if (locationId) {
          setBranches([{ id: locationId, name: branchName || 'Current Branch' }]);
        }

        const docList: DoctorOption[] = [];
        const docNameMap = new Map<string, string>();
        if (docRes.status === 'fulfilled' && !docRes.value.error && Array.isArray(docRes.value.data)) {
          for (const d of docRes.value.data) {
            const id = String(d.id);
            const name = String(d.full_name || 'Doctor');
            const quota = typeof d.daily_quota === 'number' && d.daily_quota > 0 ? d.daily_quota : 30;
            docList.push({ id, name, dailyQuota: quota });
            docNameMap.set(id, name);
          }
        }
        setDoctors(docList);

        if (rpcRes.status === 'fulfilled' && rpcRes.value && typeof rpcRes.value.avg_consultation_duration_mins === 'number' && rpcRes.value.avg_consultation_duration_mins > 0) {
          setRpcAvgDuration(Math.round(rpcRes.value.avg_consultation_duration_mins));
        } else {
          setRpcAvgDuration(null);
        }

        const lateApptIds = new Set<string>();
        const leaveEvents: LeaveRecord[] = [];
        const seenLeaveKeys = new Set<string>();

        if (logsRes.status === 'fulfilled' && !logsRes.value.error && Array.isArray(logsRes.value.data)) {
          for (const log of logsRes.value.data) {
            const reasonStr = String(log.reason || '').toLowerCase();
            if (reasonStr.includes('late') && log.appointment_id) {
              lateApptIds.add(String(log.appointment_id));
            }
          }
        }

        const normalizedAppts: NormalizedAppointment[] = [];
        const apptMetaById = new Map<string, NormalizedAppointment>();

        if (apptRes.status === 'fulfilled') {
          if (apptRes.value.error) {
            setFetchError(apptRes.value.error.message);
          } else {
            for (const row of apptRes.value.data || []) {
              const status = String(row.status || 'Waiting');
              const lowerStatus = status.toLowerCase();
              const ist = parseISTDateAndHour(row.scheduled_time || row.created_at);
              if (!ist) continue;

              const dateKey = `${formatMonthKey(ist.year, ist.month)}-${String(ist.day).padStart(2, '0')}`;
              const isCancelled = lowerStatus === 'cancelled' || lowerStatus === 'reallocated';
              const isCompleted = lowerStatus === 'completed';
              const isPastWaiting = (lowerStatus === 'waiting' || lowerStatus === 'confirmed') && dateKey < todayIST;
              const isNoShow = lowerStatus === 'no_show' || lowerStatus === 'no show' || isPastWaiting;

              let durationMins: number | null = null;
              let durationSource: 'measured' | 'recorded' | null = null;
              if (row.started_at && row.completed_at) {
                const startMs = new Date(row.started_at).getTime();
                const endMs = new Date(row.completed_at).getTime();
                if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
                  const diffMins = Math.round((endMs - startMs) / 60000);
                  if (diffMins >= 1 && diffMins <= 180) {
                    durationMins = diffMins;
                    durationSource = 'measured';
                  }
                }
              }
              if (durationMins === null && isCompleted && typeof row.consultation_duration_mins === 'number' && row.consultation_duration_mins > 0) {
                durationMins = row.consultation_duration_mins;
                durationSource = 'recorded';
              }

              const apptId = String(row.id);
              const cancelReason = isCancelled
                ? String(row.cancellation_reason || 'Unspecified Reason').trim()
                : null;

              const apptObj: NormalizedAppointment = {
                id: apptId,
                patientId: String(row.patient_id || ''),
                patientName: '',
                phone: '',
                branchId: String(row.location_id || locationId || ''),
                doctorId: String(row.doctor_id || ''),
                status,
                isCompleted,
                isCancelled,
                isNoShow,
                cancellationReason: cancelReason,
                channel: isWhatsAppChannel(row.visit_type, row.booking_channel) ? 'whatsapp' : 'walkin',
                year: ist.year,
                month: ist.month,
                day: ist.day,
                monthKey: formatMonthKey(ist.year, ist.month),
                dateKey,
                hour: ist.hour,
                durationMins,
                durationSource,
                diagnosis: isCompleted ? classifyDiagnosis(row.clinical_notes) : null,
                isLate: lateApptIds.has(apptId),
              };
              normalizedAppts.push(apptObj);
              apptMetaById.set(apptId, apptObj);
            }
          }
        }
        setDbAppointments(normalizedAppts);

        if (logsRes.status === 'fulfilled' && !logsRes.value.error && Array.isArray(logsRes.value.data)) {
          for (const log of logsRes.value.data) {
            const actionStr = String(log.action || '').toLowerCase();
            const reasonStr = String(log.reason || '').toLowerCase();
            if (reasonStr.includes('leave') || actionStr.includes('reassigned')) {
              const linked = log.appointment_id ? apptMetaById.get(String(log.appointment_id)) : undefined;
              const ist = parseISTDateAndHour(log.logged_at);
              const dKey = linked?.dateKey || (ist ? `${formatMonthKey(ist.year, ist.month)}-${String(ist.day).padStart(2, '0')}` : '');
              const docId = linked?.doctorId || '';
              if (dKey && docId && docNameMap.has(docId)) {
                const key = `${docId}-${dKey}`;
                if (!seenLeaveKeys.has(key)) {
                  seenLeaveKeys.add(key);
                  leaveEvents.push({
                    dateKey: dKey,
                    doctorId: docId,
                    doctorName: docNameMap.get(docId) || 'Doctor',
                    type: 'Reallocated / Leave',
                    upcoming: dKey > todayIST,
                  });
                }
              }
            }
          }
        }
        setDbLeaves(leaveEvents);

        const waRecords: WaLinkRecord[] = [];
        if (waRes.status === 'fulfilled' && !waRes.value.error && Array.isArray(waRes.value.data)) {
          for (const wr of waRes.value.data) {
            const ist = parseISTDateAndHour(wr.created_at);
            const dKey = ist
              ? `${formatMonthKey(ist.year, ist.month)}-${String(ist.day).padStart(2, '0')}`
              : String(wr.preferred_date || todayIST);
            const st = String(wr.status || '').toLowerCase();
            const booked = st === 'confirmed' || st === 'completed' || st === 'booked';
            waRecords.push({
              dateKey: dKey,
              branchId: String(wr.location_id || ''),
              booked,
            });
          }
        }
        setDbWaLinks(waRecords);

        const invPriceById = new Map<string, { name: string; sell: number | null; cost: number | null }>();
        const stockRows: PharmacyStockRow[] = [];

        if (invRes.status === 'fulfilled' && !invRes.value.error && Array.isArray(invRes.value.data)) {
          for (const inv of invRes.value.data) {
            if (clinicId && inv.clinic_id && String(inv.clinic_id) !== clinicId) continue;
            const label = String(inv.brand_name || inv.generic_name || 'Medicine');
            const qty = Number(inv.stock_quantity) || 0;
            const sell = typeof inv.unit_price === 'number' && inv.unit_price > 0 ? inv.unit_price : null;
            const cost = typeof inv.purchase_price === 'number' && inv.purchase_price > 0 ? inv.purchase_price : sell;
            invPriceById.set(String(inv.id), { name: label, sell, cost });
            stockRows.push({
              branchId: String(inv.location_id || ''),
              molecule: label,
              unitsOnHand: qty,
              stockValue: cost !== null ? qty * cost : null,
            });
          }
        }

        const medNameById = new Map<string, string>();
        if (medRes.status === 'fulfilled' && !medRes.value.error && Array.isArray(medRes.value.data)) {
          for (const m of medRes.value.data) {
            if (clinicId && m.clinic_id && String(m.clinic_id) !== clinicId) continue;
            medNameById.set(String(m.id), String(m.brand_name || m.generic_name || 'Medicine'));
          }
        }

        const batchPriceById = new Map<string, { sell: number | null; cost: number | null }>();
        if (batchRes.status === 'fulfilled' && !batchRes.value.error && Array.isArray(batchRes.value.data)) {
          for (const b of batchRes.value.data) {
            if (clinicId && b.clinic_id && String(b.clinic_id) !== clinicId) continue;
            const sell = typeof b.selling_price === 'number' && b.selling_price > 0 ? b.selling_price : null;
            const cost = typeof b.purchase_price === 'number' && b.purchase_price > 0 ? b.purchase_price : null;
            batchPriceById.set(String(b.id), { sell, cost });

            const qty = Number(b.available_quantity) || 0;
            const medName = medNameById.get(String(b.medicine_id));
            if (medName && qty >= 0) {
              stockRows.push({
                branchId: String(b.location_id || ''),
                molecule: medName,
                unitsOnHand: qty,
                stockValue: cost !== null ? qty * cost : null,
              });
            }
          }
        }
        setDbStock(stockRows);

        const salesList: PharmacySaleEvent[] = [];
        if (rxRes.status === 'fulfilled' && !rxRes.value.error && Array.isArray(rxRes.value.data)) {
          for (const rx of rxRes.value.data) {
            const qty = Number(rx.dispensed_quantity) || 0;
            if (qty <= 0) continue;
            const linkedAppt = rx.appointment_id ? apptMetaById.get(String(rx.appointment_id)) : undefined;
            const ist = linkedAppt ? null : parseISTDateAndHour(rx.created_at);
            const dateKey = linkedAppt
              ? linkedAppt.dateKey
              : ist
              ? `${formatMonthKey(ist.year, ist.month)}-${String(ist.day).padStart(2, '0')}`
              : todayIST;

            const invInfo = rx.inventory_id ? invPriceById.get(String(rx.inventory_id)) : undefined;
            const molecule = String(rx.medicine_name || invInfo?.name || 'Prescribed Medicine').trim();

            salesList.push({
              dateKey,
              branchId: linkedAppt?.branchId || '',
              doctorId: linkedAppt?.doctorId || '',
              molecule,
              qty,
              revenue: invInfo?.sell ? qty * invInfo.sell : null,
              cost: invInfo?.cost ? qty * invInfo.cost : null,
            });
          }
        }

        if (salesList.length === 0 && movRes.status === 'fulfilled' && !movRes.value.error && Array.isArray(movRes.value.data)) {
          for (const mv of movRes.value.data) {
            const qty = Number(mv.quantity) || 0;
            if (qty <= 0) continue;
            const ist = parseISTDateAndHour(mv.date);
            if (!ist) continue;
            const dateKey = `${formatMonthKey(ist.year, ist.month)}-${String(ist.day).padStart(2, '0')}`;
            const molecule = medNameById.get(String(mv.medicine_id)) || 'Dispensed Medicine';
            const bPrice = mv.batch_id ? batchPriceById.get(String(mv.batch_id)) : undefined;

            salesList.push({
              dateKey,
              branchId: '',
              doctorId: '',
              molecule,
              qty,
              revenue: bPrice?.sell ? qty * bPrice.sell : null,
              cost: bPrice?.cost ? qty * bPrice.cost : null,
            });
          }
        }
        setDbSales(salesList);
      } catch (err: unknown) {
        if (isMounted) {
          setFetchError(err instanceof Error ? err.message : 'Unable to load clinic analytics');
        }
      } finally {
        const elapsed = Date.now() - startTime;
        if (elapsed < 350) {
          await new Promise((r) => setTimeout(r, 350 - elapsed));
        }
        if (isMounted) setIsLoading(false);
      }
    };

    void loadAllAnalyticsData();

    return () => {
      isMounted = false;
    };
  }, [clinicId, locationId, branchName, todayIST]);

  const realAppointments = useMemo(() => {
    const byId = new Map<string, NormalizedAppointment>();
    for (const row of dbAppointments) {
      byId.set(row.id, row);
    }

    const [tY, tM, tD] = todayIST.split('-').map(Number);

    const mergeQueueItem = (qItem: Patient) => {
      const lowerStatus = (qItem.status || '').toLowerCase();
      const isCancelled = lowerStatus === 'cancelled' || lowerStatus === 'reallocated';
      const isCompleted = lowerStatus === 'completed';

      const existing = byId.get(qItem.id);
      if (existing) {
        byId.set(qItem.id, {
          ...existing,
          patientId: qItem.patientDbId || existing.patientId,
          patientName: qItem.name || existing.patientName,
          phone: qItem.phone || existing.phone,
          status: qItem.status || existing.status,
          isCancelled,
          isCompleted,
          cancellationReason: isCancelled
            ? qItem.cancellationReason || existing.cancellationReason || 'Unspecified Reason'
            : null,
          branchId: qItem.locationId || existing.branchId,
          doctorId: qItem.doctorId || existing.doctorId,
        });
        return;
      }

      const dateStr = qItem.appointmentDate || todayIST;
      const [yPart, mPart, dPart] = dateStr.split('-').map(Number);
      const y = yPart || tY;
      const m = mPart || tM;
      const d = dPart || tD;
      const dateKey = `${formatMonthKey(y, m)}-${String(d).padStart(2, '0')}`;
      const hr = parseSlotTimeHour(qItem.time);

      byId.set(qItem.id, {
        id: qItem.id,
        patientId: qItem.patientDbId || '',
        patientName: qItem.name || '',
        phone: qItem.phone || '',
        branchId: qItem.locationId || locationId || '',
        doctorId: qItem.doctorId || '',
        status: qItem.status || 'Waiting',
        isCancelled,
        isCompleted,
        isNoShow: !isCancelled && !isCompleted && dateKey < todayIST,
        cancellationReason: isCancelled ? qItem.cancellationReason || 'Unspecified Reason' : null,
        channel: isWhatsAppChannel(qItem.visitType, null) ? 'whatsapp' : 'walkin',
        year: y,
        month: m,
        day: d,
        monthKey: formatMonthKey(y, m),
        dateKey,
        hour: hr,
        durationMins: null,
        durationSource: null,
        diagnosis: isCompleted ? classifyDiagnosis(qItem.notes) : null,
        isLate: false,
      });
    };

    for (const qItem of queue || []) mergeQueueItem(qItem);
    for (const cItem of cancelledAppointments || []) mergeQueueItem(cItem);

    return Array.from(byId.values());
  }, [dbAppointments, queue, cancelledAppointments, todayIST, locationId]);

  const samplePack = useMemo(() => buildSampleDataset(todayIST), [todayIST]);
  const isSampleMode = showSamplePreview && realAppointments.length === 0;

  const activeBranches = useMemo(
    () => (isSampleMode ? samplePack.branches : branches),
    [isSampleMode, samplePack.branches, branches]
  );

  const activeDoctors = useMemo(
    () => (isSampleMode ? samplePack.doctors : doctors),
    [isSampleMode, samplePack.doctors, doctors]
  );

  const allScopedWithCancelled = useMemo(() => {
    const source = isSampleMode ? samplePack.appointments : realAppointments;
    return source.filter((item) => {
      if (selectedDoctorId && item.doctorId !== selectedDoctorId) return false;
      if (cleanQuery) {
        const channelLabel = item.channel === 'whatsapp' ? 'whatsapp online' : 'walk-in walkin';
        const monthLabel = `${MONTH_SHORT[item.month - 1] || ''} ${item.year}`.toLowerCase();
        const diagLabel = (item.diagnosis || '').toLowerCase();
        const cancelLabel = (item.cancellationReason || '').toLowerCase();
        const match =
          item.patientName.toLowerCase().includes(cleanQuery) ||
          item.phone.toLowerCase().includes(cleanQuery) ||
          channelLabel.includes(cleanQuery) ||
          monthLabel.includes(cleanQuery) ||
          diagLabel.includes(cleanQuery) ||
          cancelLabel.includes(cleanQuery);
        if (!match) return false;
      }
      return true;
    });
  }, [isSampleMode, samplePack.appointments, realAppointments, selectedDoctorId, cleanQuery]);

  const activeFootfallOnly = useMemo(
    () => allScopedWithCancelled.filter((a) => !a.isCancelled),
    [allScopedWithCancelled]
  );

  const firstVisitByPatient = useMemo(() => {
    const firstDateMap = new Map<string, string>();
    for (const a of activeFootfallOnly) {
      if (!a.patientId) continue;
      const existing = firstDateMap.get(a.patientId);
      if (!existing || a.dateKey < existing) {
        firstDateMap.set(a.patientId, a.dateKey);
      }
    }
    return firstDateMap;
  }, [activeFootfallOnly]);

  const periodFilteredAllBranches = useMemo(() => {
    return activeFootfallOnly.filter((a) => {
      const diff = ageInDays(todayIST, a.dateKey);
      return diff >= 0 && diff < selectedPeriod;
    });
  }, [activeFootfallOnly, todayIST, selectedPeriod]);

  const periodFilteredAppointments = useMemo(() => {
    if (!selectedBranchId) return periodFilteredAllBranches;
    return periodFilteredAllBranches.filter((a) => a.branchId === selectedBranchId);
  }, [periodFilteredAllBranches, selectedBranchId]);

  const periodAllWithCancelled = useMemo(() => {
    return allScopedWithCancelled.filter((a) => {
      const diff = ageInDays(todayIST, a.dateKey);
      if (diff < 0 || diff >= selectedPeriod) return false;
      if (selectedBranchId && a.branchId !== selectedBranchId) return false;
      return true;
    });
  }, [allScopedWithCancelled, todayIST, selectedPeriod, selectedBranchId]);

  const trailingSixMonths = useMemo(() => getTrailingMonths(todayIST, 6), [todayIST]);

  const monthlyBuckets: MonthlyBucket[] = useMemo(() => {
    const countsByMonth = new Map<string, { walkin: number; whatsapp: number }>();
    for (const m of trailingSixMonths) {
      countsByMonth.set(m.monthKey, { walkin: 0, whatsapp: 0 });
    }

    const branchFiltered = selectedBranchId
      ? activeFootfallOnly.filter((a) => a.branchId === selectedBranchId)
      : activeFootfallOnly;

    for (const appt of branchFiltered) {
      const bucket = countsByMonth.get(appt.monthKey);
      if (!bucket) continue;
      if (appt.channel === 'whatsapp') bucket.whatsapp += 1;
      else bucket.walkin += 1;
    }

    const result: MonthlyBucket[] = [];
    for (let i = 0; i < trailingSixMonths.length; i++) {
      const m = trailingSixMonths[i];
      const counts = countsByMonth.get(m.monthKey) || { walkin: 0, whatsapp: 0 };
      const total = counts.walkin + counts.whatsapp;
      const whatsappSharePct = total > 0 ? Number(((counts.whatsapp / total) * 100).toFixed(1)) : 0;

      let momGrowthPct: number | null = null;
      if (i > 0) {
        const prevTotal = result[i - 1].total;
        if (prevTotal > 0) {
          momGrowthPct = Number((((total - prevTotal) / prevTotal) * 100).toFixed(1));
        }
      }

      result.push({
        monthKey: m.monthKey,
        shortLabel: m.shortLabel,
        fullLabel: m.fullLabel,
        walkin: counts.walkin,
        whatsapp: counts.whatsapp,
        total,
        whatsappSharePct,
        momGrowthPct,
      });
    }
    return result;
  }, [activeFootfallOnly, trailingSixMonths, selectedBranchId]);

  const branchComparisonRows = useMemo(() => {
    return activeBranches.map((branch) => {
      const rows = periodFilteredAllBranches.filter((a) => a.branchId === branch.id);
      const total = rows.length;
      const wa = rows.filter((a) => a.channel === 'whatsapp').length;
      const durations = rows
        .map((a) => a.durationMins)
        .filter((d): d is number => typeof d === 'number' && d > 0);
      const avgMins =
        durations.length > 0
          ? Number((durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(1))
          : null;
      const share = total > 0 ? Number(((wa / total) * 100).toFixed(1)) : 0;
      return {
        id: branch.id,
        name: branch.name,
        total,
        avgMins,
        whatsappShare: share,
      };
    });
  }, [activeBranches, periodFilteredAllBranches]);

  const kpiMetrics = useMemo(() => {
    let totalPatients = periodFilteredAppointments.length;
    let walkinCount = 0;
    let whatsappCount = 0;
    let newPatientVisits = 0;
    let hasPatientIds = false;
    const measuredDurations: number[] = [];
    const recordedDurations: number[] = [];

    for (const appt of periodFilteredAppointments) {
      if (appt.channel === 'whatsapp') whatsappCount += 1;
      else walkinCount += 1;

      if (appt.patientId) {
        hasPatientIds = true;
        if (firstVisitByPatient.get(appt.patientId) === appt.dateKey) {
          newPatientVisits += 1;
        }
      }

      if (appt.durationMins !== null) {
        if (appt.durationSource === 'measured') measuredDurations.push(appt.durationMins);
        else recordedDurations.push(appt.durationMins);
      }
    }

    if (!isSampleMode && !cleanQuery && !selectedBranchId && !selectedDoctorId && totalPatients === 0 && totalPatientsCount > 0) {
      totalPatients = totalPatientsCount;
    }

    const whatsappSharePct =
      walkinCount + whatsappCount > 0
        ? Number(((whatsappCount / (walkinCount + whatsappCount)) * 100).toFixed(1))
        : 0;

    let avgDurationMins: number | null = null;
    let durationLabel = 'Duration data unavailable';
    if (measuredDurations.length > 0) {
      avgDurationMins = Number(
        (measuredDurations.reduce((a, b) => a + b, 0) / measuredDurations.length).toFixed(1)
      );
      durationLabel = `Measured across ${measuredDurations.length} completed visits`;
    } else if (recordedDurations.length > 0) {
      avgDurationMins = Number(
        (recordedDurations.reduce((a, b) => a + b, 0) / recordedDurations.length).toFixed(1)
      );
      durationLabel = `Recorded slot avg (${recordedDurations.length} completed)`;
    } else if (rpcAvgDuration && !isSampleMode && !selectedBranchId && !selectedDoctorId) {
      avgDurationMins = rpcAvgDuration;
      durationLabel = 'Clinic consultation average';
    } else if (isSampleMode) {
      avgDurationMins = 13.0;
      durationLabel = 'Sample consultation average';
    }

    const latestMonth = monthlyBuckets[monthlyBuckets.length - 1];
    const latestMomGrowth = latestMonth ? latestMonth.momGrowthPct : null;

    return {
      totalPatients,
      walkinCount,
      whatsappCount,
      whatsappSharePct,
      newPatientVisits: hasPatientIds ? newPatientVisits : null,
      avgDurationMins,
      durationLabel,
      latestMomGrowth,
    };
  }, [
    periodFilteredAppointments,
    firstVisitByPatient,
    isSampleMode,
    cleanQuery,
    selectedBranchId,
    selectedDoctorId,
    totalPatientsCount,
    rpcAvgDuration,
    monthlyBuckets,
  ]);

  const hourlyData: { buckets: HourlyBucket[]; peakHours: HourlyBucket[]; maxHourTotal: number } = useMemo(() => {
    const hourMap = new Map<number, { walkin: number; whatsapp: number }>();
    let minHour = 9;
    let maxHour = 19;

    for (const appt of periodFilteredAppointments) {
      if (appt.hour === null) continue;
      if (appt.hour < minHour) minHour = appt.hour;
      if (appt.hour > maxHour) maxHour = appt.hour;
      const curr = hourMap.get(appt.hour) || { walkin: 0, whatsapp: 0 };
      if (appt.channel === 'whatsapp') curr.whatsapp += 1;
      else curr.walkin += 1;
      hourMap.set(appt.hour, curr);
    }

    minHour = Math.max(6, minHour);
    maxHour = Math.min(22, maxHour);

    const buckets: HourlyBucket[] = [];
    let maxTotal = 0;
    for (let h = minHour; h <= maxHour; h++) {
      const entry = hourMap.get(h) || { walkin: 0, whatsapp: 0 };
      const total = entry.walkin + entry.whatsapp;
      if (total > maxTotal) maxTotal = total;
      buckets.push({
        hour: h,
        label: formatHourLabel(h, false),
        shortLabel: formatHourLabel(h, true),
        walkin: entry.walkin,
        whatsapp: entry.whatsapp,
        total,
      });
    }

    const peakHours = maxTotal > 0 ? buckets.filter((b) => b.total === maxTotal) : [];
    return { buckets, peakHours, maxHourTotal: maxTotal };
  }, [periodFilteredAppointments]);

  const clinicalAndPharmacy = useMemo(() => {
    const diagCounts = new Map<string, number>();
    for (const appt of periodFilteredAppointments) {
      if (!appt.diagnosis) continue;
      diagCounts.set(appt.diagnosis, (diagCounts.get(appt.diagnosis) || 0) + 1);
    }
    const sortedDiag = Array.from(diagCounts.entries())
      .filter(([, cnt]) => cnt > 0)
      .sort((a, b) => b[1] - a[1]);
    const topDiag = sortedDiag.slice(0, 4).map(([label, count]) => ({ label, count }));
    const restCount = sortedDiag.slice(4).reduce((s, [, cnt]) => s + cnt, 0);
    const caseMix = restCount > 0 ? [...topDiag, { label: 'Other', count: restCount }] : topDiag;

    const salesSource = isSampleMode ? samplePack.sales : dbSales;
    const filteredSales = salesSource.filter((s) => {
      const diff = ageInDays(todayIST, s.dateKey);
      if (diff < 0 || diff >= selectedPeriod) return false;
      if (selectedBranchId && s.branchId && s.branchId !== selectedBranchId) return false;
      if (selectedDoctorId && s.doctorId && s.doctorId !== selectedDoctorId) return false;
      if (cleanQuery && !s.molecule.toLowerCase().includes(cleanQuery)) return false;
      return true;
    });

    const stockSource = isSampleMode ? samplePack.stock : dbStock;
    const filteredStock = stockSource.filter((st) => {
      if (selectedBranchId && st.branchId && st.branchId !== selectedBranchId) return false;
      if (cleanQuery && !st.molecule.toLowerCase().includes(cleanQuery)) return false;
      return true;
    });

    const moleculeMap = new Map<
      string,
      { name: string; unitsSold: number; revenue: number; hasRevenue: boolean; cost: number; stockValue: number; hasStockValue: boolean }
    >();

    let totalRevenue = 0;
    let hasAnyRevenue = false;
    let totalCost = 0;
    let hasAnyCost = false;

    for (const s of filteredSales) {
      const curr = moleculeMap.get(s.molecule) || {
        name: s.molecule,
        unitsSold: 0,
        revenue: 0,
        hasRevenue: false,
        cost: 0,
        stockValue: 0,
        hasStockValue: false,
      };
      curr.unitsSold += s.qty;
      if (s.revenue !== null) {
        curr.revenue += s.revenue;
        curr.hasRevenue = true;
        totalRevenue += s.revenue;
        hasAnyRevenue = true;
      }
      if (s.cost !== null) {
        curr.cost += s.cost;
        totalCost += s.cost;
        hasAnyCost = true;
      }
      moleculeMap.set(s.molecule, curr);
    }

    let totalStockValue = 0;
    let hasAnyStockValue = false;

    for (const st of filteredStock) {
      const curr = moleculeMap.get(st.molecule) || {
        name: st.molecule,
        unitsSold: 0,
        revenue: 0,
        hasRevenue: false,
        cost: 0,
        stockValue: 0,
        hasStockValue: false,
      };
      if (st.stockValue !== null) {
        curr.stockValue += st.stockValue;
        curr.hasStockValue = true;
        totalStockValue += st.stockValue;
        hasAnyStockValue = true;
      }
      moleculeMap.set(st.molecule, curr);
    }

    const molecules = Array.from(moleculeMap.values()).sort(
      (a, b) => b.unitsSold - a.unitsSold || b.stockValue - a.stockValue
    );

    const fastMoving = molecules.filter((m) => m.unitsSold > 0).slice(0, 7);
    const topRevenueMolecules = molecules.filter((m) => m.hasRevenue && m.revenue > 0).slice(0, 7);

    const stockTurnover =
      hasAnyCost && totalCost > 0 && hasAnyStockValue && totalStockValue > 0
        ? Number(((totalCost * (365 / selectedPeriod)) / totalStockValue).toFixed(1))
        : null;

    return {
      caseMix,
      molecules,
      fastMoving,
      topRevenueMolecules,
      totalRevenue: hasAnyRevenue ? totalRevenue : null,
      totalStockValue: hasAnyStockValue ? totalStockValue : null,
      stockTurnover,
    };
  }, [
    periodFilteredAppointments,
    isSampleMode,
    samplePack.sales,
    samplePack.stock,
    dbSales,
    dbStock,
    todayIST,
    selectedPeriod,
    selectedBranchId,
    selectedDoctorId,
    cleanQuery,
  ]);

  const queueMetrics = useMemo(() => {
    const totalBookings = periodAllWithCancelled.length;
    const cancelledList = periodAllWithCancelled.filter((a) => a.isCancelled);
    const noShowList = periodAllWithCancelled.filter((a) => !a.isCancelled && a.isNoShow);
    const arrivedList = periodAllWithCancelled.filter((a) => !a.isCancelled && !a.isNoShow);
    const lateArrivedCount = arrivedList.filter((a) => a.isLate).length;

    const cancelRate = totalBookings > 0 ? Number(((cancelledList.length / totalBookings) * 100).toFixed(1)) : 0;
    const noShowRate = totalBookings > 0 ? Number(((noShowList.length / totalBookings) * 100).toFixed(1)) : 0;
    const lateRate = arrivedList.length > 0 ? Number(((lateArrivedCount / arrivedList.length) * 100).toFixed(1)) : 0;

    const reasonMap = new Map<string, number>();
    for (const c of cancelledList) {
      const rLabel = c.cancellationReason || 'Unspecified Reason';
      reasonMap.set(rLabel, (reasonMap.get(rLabel) || 0) + 1);
    }
    const reasons = Array.from(reasonMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const waLinkSource = isSampleMode ? samplePack.waLinks : dbWaLinks;
    const scopedWaLinks = waLinkSource.filter((w) => {
      const diff = ageInDays(todayIST, w.dateKey);
      if (diff < 0 || diff >= selectedPeriod) return false;
      if (selectedBranchId && w.branchId && w.branchId !== selectedBranchId) return false;
      return true;
    });
    const linksSent = scopedWaLinks.length;
    const linkBookings = scopedWaLinks.filter((w) => w.booked).length;
    const waConversion = linksSent > 0 ? Number(((linkBookings / linksSent) * 100).toFixed(1)) : 0;

    const leavesSource = isSampleMode ? samplePack.leaves : dbLeaves;
    const openDays = new Set(periodAllWithCancelled.filter((a) => !a.isCancelled).map((a) => a.dateKey)).size;

    const quotaDoctors = activeDoctors.filter((d) => !selectedDoctorId || d.id === selectedDoctorId);
    const quotaRows = quotaDoctors.map((doc) => {
      const docAppts = allScopedWithCancelled.filter((a) => {
        const diff = ageInDays(todayIST, a.dateKey);
        if (diff < 0 || diff >= selectedPeriod) return false;
        return a.doctorId === doc.id && !a.isCancelled;
      });
      const leaveDaysCount = leavesSource.filter((l) => {
        const diff = ageInDays(todayIST, l.dateKey);
        return diff >= 0 && diff < selectedPeriod && l.doctorId === doc.id;
      }).length;
      const workDays = Math.max(openDays - leaveDaysCount, docAppts.length > 0 ? 1 : 0);
      const perDay = workDays > 0 ? docAppts.length / workDays : 0;
      const usedPct = doc.dailyQuota > 0 ? Number(((perDay / doc.dailyQuota) * 100).toFixed(1)) : 0;
      return {
        id: doc.id,
        name: doc.name,
        dailyQuota: doc.dailyQuota,
        perDay,
        usedPct,
      };
    });

    const completedCount = periodAllWithCancelled.filter((a) => a.isCompleted).length;
    const inProgressCount = periodAllWithCancelled.filter(
      (a) => !a.isCancelled && !a.isCompleted && a.status.toLowerCase().includes('progress')
    ).length;
    const waitingCount = periodAllWithCancelled.filter(
      (a) => !a.isCancelled && !a.isCompleted && !a.isNoShow && !a.status.toLowerCase().includes('progress')
    ).length;
    const todayRows = allScopedWithCancelled.filter((a) => a.dateKey === todayIST);
    const todayWaiting = todayRows.filter(
      (a) => !a.isCancelled && !a.isCompleted && !a.isNoShow && !a.status.toLowerCase().includes('progress')
    ).length;
    const todayInProgress = todayRows.filter(
      (a) => !a.isCancelled && !a.isCompleted && a.status.toLowerCase().includes('progress')
    ).length;

    const statusBreakdown = [
      {
        label: 'Waiting',
        count: waitingCount,
        pct: totalBookings > 0 ? Number(((waitingCount / totalBookings) * 100).toFixed(1)) : 0,
        color: '#F59E0B',
        barColor: 'rgba(245, 158, 11, 0.88)',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
        note: todayWaiting > 0 ? `${todayWaiting} waiting today` : 'Active queue',
      },
      {
        label: 'In Progress',
        count: inProgressCount,
        pct: totalBookings > 0 ? Number(((inProgressCount / totalBookings) * 100).toFixed(1)) : 0,
        color: '#2563EB',
        barColor: 'rgba(37, 99, 235, 0.9)',
        badgeClass: 'bg-blue-50 text-[#2563EB] border-blue-200/80',
        note: todayInProgress > 0 ? `${todayInProgress} in chamber` : 'Consulting',
      },
      {
        label: 'Completed',
        count: completedCount,
        pct: totalBookings > 0 ? Number(((completedCount / totalBookings) * 100).toFixed(1)) : 0,
        color: '#10B981',
        barColor: 'rgba(16, 185, 129, 0.88)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        note: 'Consultations finished',
      },
      {
        label: 'Cancelled',
        count: cancelledList.length,
        pct: cancelRate,
        color: '#F43F5E',
        barColor: 'rgba(244, 63, 94, 0.85)',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
        note: noShowList.length > 0 ? `${noShowList.length} no-show` : 'Cancelled / reallocated',
      },
    ];

    return {
      totalBookings,
      cancellations: cancelledList.length,
      noShows: noShowList.length,
      arrivedCount: arrivedList.length,
      lateArrivedCount,
      cancelRate,
      noShowRate,
      lateRate,
      reasons,
      linksSent,
      linkBookings,
      waConversion,
      quotaRows,
      statusBreakdown,
      todayWaiting,
      todayInProgress,
    };
  }, [
    periodAllWithCancelled,
    allScopedWithCancelled,
    isSampleMode,
    samplePack.waLinks,
    samplePack.leaves,
    dbWaLinks,
    dbLeaves,
    todayIST,
    selectedPeriod,
    selectedBranchId,
    selectedDoctorId,
    activeDoctors,
  ]);

  const doctorColorMap = useMemo(() => {
    const map = new Map<string, string>();
    activeDoctors.forEach((doc, idx) => {
      map.set(doc.id, SERIES_PALETTE[idx % SERIES_PALETTE.length]);
    });
    return map;
  }, [activeDoctors]);

  const doctorReport = useMemo(() => {
    const shownDoctors = activeDoctors.filter((d) => !selectedDoctorId || d.id === selectedDoctorId);
    const shownBranches = activeBranches.filter((b) => !selectedBranchId || b.id === selectedBranchId);
    const leavesSource = isSampleMode ? samplePack.leaves : dbLeaves;

    const summariseDocRows = (rows: NormalizedAppointment[]) => {
      const consultedRows = rows.filter((r) => r.isCompleted);
      const baseRows = consultedRows.length > 0 ? consultedRows : rows.filter((r) => !r.isCancelled);
      const byBranch = shownBranches.map((b) => baseRows.filter((r) => r.branchId === b.id).length);
      const validDurations = baseRows
        .map((r) => r.durationMins)
        .filter((d): d is number => typeof d === 'number' && d > 0);
      const totalMins = validDurations.reduce((s, d) => s + d, 0);
      const avgMins = validDurations.length > 0 ? totalMins / validDurations.length : null;
      return {
        consulted: consultedRows.length,
        totalVisits: baseRows.length,
        byBranch,
        totalMins: validDurations.length > 0 ? totalMins : null,
        avgMins,
      };
    };

    const summary = shownDoctors.map((doc) => {
      const docRows = periodFilteredAppointments.filter((a) => a.doctorId === doc.id);
      const leaveDays = leavesSource.filter((l) => {
        const diff = ageInDays(todayIST, l.dateKey);
        return diff >= 0 && diff < selectedPeriod && l.doctorId === doc.id;
      }).length;
      return {
        id: doc.id,
        name: doc.name,
        color: doctorColorMap.get(doc.id) || SERIES_PALETTE[0],
        ...summariseDocRows(docRows),
        leaveDays,
      };
    });

    const trailing7Dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      trailing7Dates.push(shiftDateYmd(todayIST, -i));
    }

    const overviewDates = overviewDateFilter ? [overviewDateFilter] : trailing7Dates;
    const overviewDoctors = activeDoctors.filter((d) => !overviewDoctorId || d.id === overviewDoctorId);

    const dailyRows = overviewDates
      .slice()
      .reverse()
      .flatMap((dateKey) =>
        overviewDoctors.map((doc) => {
          const allForDay = allScopedWithCancelled.filter(
            (a) =>
              a.dateKey === dateKey &&
              a.doctorId === doc.id &&
              (!selectedBranchId || a.branchId === selectedBranchId)
          );
          const nonCancelled = allForDay.filter((a) => !a.isCancelled);
          const onLeave = leavesSource.some((l) => l.dateKey === dateKey && l.doctorId === doc.id);
          return {
            date: dateKey,
            doctorId: doc.id,
            name: doc.name,
            color: doctorColorMap.get(doc.id) || SERIES_PALETTE[0],
            booked: allForDay.length,
            ...summariseDocRows(nonCancelled),
            onLeave,
          };
        })
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.booked - a.booked || b.consulted - a.consulted);

    const leaves = leavesSource
      .filter((l) => ageInDays(todayIST, l.dateKey) < selectedPeriod && shownDoctors.some((d) => d.id === l.doctorId))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      .map((l) => ({
        ...l,
        color: doctorColorMap.get(l.doctorId) || SERIES_PALETTE[0],
      }));

    return {
      branchNames: shownBranches.map((b) => b.name),
      summary,
      dayLabels: overviewDates,
      dailyRows,
      leaves,
    };
  }, [
    activeDoctors,
    activeBranches,
    doctorColorMap,
    selectedDoctorId,
    overviewDoctorId,
    selectedBranchId,
    isSampleMode,
    samplePack.leaves,
    dbLeaves,
    periodFilteredAppointments,
    allScopedWithCancelled,
    todayIST,
    selectedPeriod,
    overviewDateFilter,
  ]);

  const pagedDoctorSummary = useMemo(
    () => getPaginatedSlice(doctorReport.summary, doctorSummaryPage, DOCTOR_TABLE_PAGE_SIZE),
    [doctorReport.summary, doctorSummaryPage]
  );

  const pagedDoctorDaily = useMemo(
    () => getPaginatedSlice(doctorReport.dailyRows, doctorDailyPage, DOCTOR_TABLE_PAGE_SIZE),
    [doctorReport.dailyRows, doctorDailyPage]
  );

  const pagedDoctorLeaves = useMemo(
    () => getPaginatedSlice(doctorReport.leaves, doctorLeavesPage, DOCTOR_TABLE_PAGE_SIZE),
    [doctorReport.leaves, doctorLeavesPage]
  );

  const pagedDoctorQuota = useMemo(
    () => getPaginatedSlice(queueMetrics.quotaRows, doctorQuotaPage, DOCTOR_TABLE_PAGE_SIZE),
    [queueMetrics.quotaRows, doctorQuotaPage]
  );

  const branchChartData: ChartConfiguration<'bar'>['data'] = useMemo(
    () => ({
      labels: branchComparisonRows.map((b) => b.name),
      datasets: [
        {
          label: 'Visits',
          data: branchComparisonRows.map((b) => b.total),
          backgroundColor: 'rgba(37, 99, 235, 0.9)',
          hoverBackgroundColor: '#1D4ED8',
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    }),
    [branchComparisonRows]
  );

  const branchChartOptions: ChartConfiguration<'bar'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B',
          padding: 10,
          cornerRadius: 10,
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 11, weight: 'bold' } } },
        y: { beginAtZero: true, grace: '18%', border: { display: false }, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#94A3B8', font: { size: 11 } } },
      },
    }),
    []
  );

  const footfallColumnChartData: ChartConfiguration<'bar'>['data'] = useMemo(
    () => ({
      labels: monthlyBuckets.map((m) => m.shortLabel),
      datasets: [
        {
          label: 'Walk-in Patients',
          data: monthlyBuckets.map((m) => m.walkin),
          backgroundColor: 'rgba(37, 99, 235, 0.9)',
          hoverBackgroundColor: '#1D4ED8',
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.72,
          categoryPercentage: 0.68,
        },
        {
          label: 'WhatsApp Bookings',
          data: monthlyBuckets.map((m) => m.whatsapp),
          backgroundColor: 'rgba(16, 185, 129, 0.88)',
          hoverBackgroundColor: '#059669',
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.72,
          categoryPercentage: 0.68,
        },
      ],
    }),
    [monthlyBuckets]
  );

  const footfallColumnChartOptions: ChartConfiguration<'bar'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 16,
            color: '#475569',
            font: { size: 11, weight: 'bold', family: 'Inter, system-ui, sans-serif' },
          },
        },
        tooltip: {
          backgroundColor: '#1E293B',
          titleColor: '#F8FAFC',
          bodyColor: '#CBD5E1',
          borderColor: 'rgba(148, 163, 184, 0.25)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            title: (items) => monthlyBuckets[items[0]?.dataIndex ?? 0]?.fullLabel || '',
            afterBody: (items) => {
              const bucket = monthlyBuckets[items[0]?.dataIndex ?? 0];
              if (!bucket) return '';
              const growthTxt =
                bucket.momGrowthPct !== null
                  ? ` (${bucket.momGrowthPct >= 0 ? '+' : ''}${bucket.momGrowthPct}% MoM)`
                  : '';
              return `\nTotal Intake: ${bucket.total} patients${growthTxt}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748B', font: { size: 11, weight: 'bold' } } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#94A3B8', font: { size: 11 } } },
      },
    }),
    [monthlyBuckets]
  );

  const monthlyTrendChartData: ChartConfiguration<'line'>['data'] = useMemo(
    () => ({
      labels: monthlyBuckets.map((m) => m.shortLabel),
      datasets: [
        {
          label: 'Total Monthly Footfall',
          data: monthlyBuckets.map((m) => m.total),
          borderColor: '#2563EB',
          backgroundColor: (context: ScriptableContext<'line'>) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(37, 99, 235, 0.14)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(37, 99, 235, 0.24)');
            gradient.addColorStop(1, 'rgba(37, 99, 235, 0.01)');
            return gradient;
          },
          fill: true,
          tension: 0.36,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#FFFFFF',
          pointBorderColor: '#2563EB',
          pointBorderWidth: 2.5,
        },
      ],
    }),
    [monthlyBuckets]
  );

  const monthlyTrendChartOptions: ChartConfiguration<'line'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            title: (items) => monthlyBuckets[items[0]?.dataIndex ?? 0]?.fullLabel || '',
            label: (item) => {
              const bucket = monthlyBuckets[item.dataIndex];
              return bucket ? ` Total Footfall: ${bucket.total} patients` : '';
            },
            afterLabel: (item) => {
              const bucket = monthlyBuckets[item.dataIndex];
              if (!bucket) return '';
              const momLine =
                bucket.momGrowthPct !== null
                  ? ` Intake Growth: ${bucket.momGrowthPct >= 0 ? '+' : ''}${bucket.momGrowthPct}% vs prev month`
                  : ' Intake Growth: Baseline month';
              return [` Walk-in: ${bucket.walkin} · WhatsApp: ${bucket.whatsapp}`, momLine];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748B', font: { size: 11, weight: 'bold' } } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#94A3B8', font: { size: 11 } } },
      },
    }),
    [monthlyBuckets]
  );

  const peakHoursChartData: ChartConfiguration<'bar'>['data'] = useMemo(() => {
    const { buckets, maxHourTotal } = hourlyData;
    const barColors = buckets.map((b) => {
      if (maxHourTotal === 0 || b.total === 0) return 'rgba(226, 232, 240, 0.7)';
      if (b.total === maxHourTotal) return '#2563EB';
      if (b.total >= maxHourTotal * 0.75) return '#3B82F6';
      if (b.total >= maxHourTotal * 0.45) return '#60A5FA';
      return '#BFDBFE';
    });

    return {
      labels: buckets.map((b) => b.label),
      datasets: [
        {
          label: 'Arrivals',
          data: buckets.map((b) => b.total),
          backgroundColor: barColors,
          hoverBackgroundColor: '#1D4ED8',
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.68,
        },
      ],
    };
  }, [hourlyData]);

  const peakHoursChartOptions: ChartConfiguration<'bar'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            title: (items) => {
              const b = hourlyData.buckets[items[0]?.dataIndex ?? 0];
              return b ? `${b.label} Arrival Window` : '';
            },
            label: (item) => {
              const b = hourlyData.buckets[item.dataIndex];
              return b ? ` Total Arrivals: ${b.total} patient${b.total === 1 ? '' : 's'}` : '';
            },
            afterLabel: (item) => {
              const b = hourlyData.buckets[item.dataIndex];
              return b ? ` Walk-in: ${b.walkin} · WhatsApp: ${b.whatsapp}` : '';
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748B', maxRotation: 0, autoSkip: true, font: { size: 10, weight: 'bold' } } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#94A3B8', font: { size: 11 } } },
      },
    }),
    [hourlyData]
  );

  const caseMixDoughnutData: ChartConfiguration<'doughnut'>['data'] = useMemo(
    () => ({
      labels: clinicalAndPharmacy.caseMix.map((c) => c.label),
      datasets: [
        {
          data: clinicalAndPharmacy.caseMix.map((c) => c.count),
          backgroundColor: SERIES_PALETTE.slice(0, clinicalAndPharmacy.caseMix.length),
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 6,
        },
      ],
    }),
    [clinicalAndPharmacy.caseMix]
  );

  const caseMixDoughnutOptions: ChartConfiguration<'doughnut'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'right',
          labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14, color: '#475569', font: { size: 11, weight: 'bold' } },
        },
        tooltip: { backgroundColor: '#1E293B', padding: 10, cornerRadius: 10 },
      },
    }),
    []
  );

  const fastMoleculesChartData: ChartConfiguration<'bar'>['data'] = useMemo(
    () => ({
      labels: clinicalAndPharmacy.fastMoving.map((m) => m.name),
      datasets: [
        {
          label: 'Units Sold',
          data: clinicalAndPharmacy.fastMoving.map((m) => m.unitsSold),
          backgroundColor: 'rgba(37, 99, 235, 0.88)',
          hoverBackgroundColor: '#1D4ED8',
          borderRadius: 6,
          barThickness: 20,
        },
      ],
    }),
    [clinicalAndPharmacy.fastMoving]
  );

  const horizontalBarOptions: ChartConfiguration<'bar'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      layout: { padding: { right: 42 } },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1E293B', padding: 10, cornerRadius: 10 } },
      scales: {
        x: { beginAtZero: true, border: { display: false }, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#94A3B8', font: { size: 11 } } },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: '#334155', font: { size: 11, weight: 'bold' } } },
      },
    }),
    []
  );

  const cancelReasonsChartData: ChartConfiguration<'bar'>['data'] = useMemo(
    () => ({
      labels: queueMetrics.reasons.map((r) => r.label),
      datasets: [
        {
          label: 'Cancellations',
          data: queueMetrics.reasons.map((r) => r.count),
          backgroundColor: queueMetrics.reasons.map((_, i) => CANCEL_PALETTE[i % CANCEL_PALETTE.length]),
          borderRadius: 6,
          maxBarThickness: 36,
        },
      ],
    }),
    [queueMetrics.reasons]
  );

  const cancelReasonsBarOptions: ChartConfiguration<'bar'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B',
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: (item) => {
              const count = Number(item.raw) || 0;
              const total = queueMetrics.reasons.reduce((s, r) => s + r.count, 0);
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
              return ` Cancellations: ${count} (${pct}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: '#475569',
            font: { size: 10, weight: 'bold' },
            maxRotation: 0,
            callback: function (_val, index) {
              const label = queueMetrics.reasons[index]?.label || '';
              return label.length > 18 ? `${label.slice(0, 16)}…` : label;
            },
          },
        },
        y: {
          beginAtZero: true,
          grace: '20%',
          border: { display: false },
          grid: { color: '#F1F5F9' },
          ticks: { precision: 0, color: '#94A3B8', font: { size: 11 } },
        },
      },
    }),
    [queueMetrics.reasons]
  );

  const queueStatusChartData: ChartConfiguration<'bar'>['data'] = useMemo(
    () => ({
      labels: queueMetrics.statusBreakdown.map((s) => s.label),
      datasets: [
        {
          label: 'Appointments',
          data: queueMetrics.statusBreakdown.map((s) => s.count),
          backgroundColor: queueMetrics.statusBreakdown.map((s) => s.barColor),
          borderRadius: 6,
          barThickness: 22,
        },
      ],
    }),
    [queueMetrics.statusBreakdown]
  );

  const waConversionChartData: ChartConfiguration<'bar'>['data'] = useMemo(
    () => ({
      labels: ['Links Sent', 'Bookings Made'],
      datasets: [
        {
          label: 'Count',
          data: [queueMetrics.linksSent, queueMetrics.linkBookings],
          backgroundColor: ['rgba(59, 130, 246, 0.85)', 'rgba(16, 185, 129, 0.88)'],
          borderRadius: 6,
          barThickness: 26,
        },
      ],
    }),
    [queueMetrics.linksSent, queueMetrics.linkBookings]
  );

  const doctorQuotaChartData: ChartConfiguration<'bar'>['data'] = useMemo(
    () => ({
      labels: queueMetrics.quotaRows.map((q) => q.name),
      datasets: [
        {
          label: 'Quota Used %',
          data: queueMetrics.quotaRows.map((q) => q.usedPct),
          backgroundColor: queueMetrics.quotaRows.map((q) => (q.usedPct >= 85 ? '#F59E0B' : '#2563EB')),
          borderRadius: 6,
          maxBarThickness: 36,
        },
      ],
    }),
    [queueMetrics.quotaRows]
  );

  const doctorPatientsBranchChartData: ChartConfiguration<'bar'>['data'] = useMemo(() => {
    return {
      labels: doctorReport.summary.map((d) => d.name),
      datasets: [
        {
          label: 'Patients',
          data: doctorReport.summary.map((d) => d.totalVisits),
          backgroundColor: doctorReport.summary.map((d) => d.color),
          hoverBackgroundColor: doctorReport.summary.map((d) => d.color),
          borderRadius: 6,
          maxBarThickness: 36,
        },
      ],
    };
  }, [doctorReport.summary]);

  const doctorPatientsChartOptions: ChartConfiguration<'bar'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (item) => {
              const doc = doctorReport.summary[item.dataIndex];
              if (!doc) return '';
              return ` Patients: ${doc.totalVisits.toLocaleString('en-IN')} (${doc.consulted.toLocaleString('en-IN')} completed)`;
            },
            afterLabel: (item) => {
              const doc = doctorReport.summary[item.dataIndex];
              if (!doc) return '';
              const lines = [
                ` Total Time: ${doc.totalMins !== null ? formatHoursMins(doc.totalMins) : 'N/A'}`,
                ` Avg / Patient: ${doc.avgMins !== null ? `${doc.avgMins.toFixed(1)} min` : 'N/A'}`,
              ];
              if (doctorReport.branchNames.length > 1) {
                doctorReport.branchNames.forEach((bn, idx) => {
                  lines.push(` ${bn}: ${(doc.byBranch[idx] ?? 0).toLocaleString('en-IN')}`);
                });
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 11, weight: 'bold' } } },
        y: { beginAtZero: true, grace: '18%', border: { display: false }, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#94A3B8', font: { size: 11 } } },
      },
    }),
    [doctorReport.summary, doctorReport.branchNames]
  );

  const doctorBookedVsSeenChartData: ChartConfiguration<'bar'>['data'] = useMemo(() => {
    const isSingleDay = doctorReport.dayLabels.length === 1;
    return {
      labels: doctorReport.dayLabels.map((d) => d.slice(5)),
      datasets: [
        {
          label: 'Booked',
          data: doctorReport.dayLabels.map((day) =>
            doctorReport.dailyRows.filter((r) => r.date === day).reduce((s, r) => s + r.booked, 0)
          ),
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          borderRadius: 4,
          maxBarThickness: 28,
          barPercentage: 0.7,
          categoryPercentage: isSingleDay ? 0.32 : 0.72,
        },
        {
          label: 'Consulted',
          data: doctorReport.dayLabels.map((day) =>
            doctorReport.dailyRows.filter((r) => r.date === day).reduce((s, r) => s + r.consulted, 0)
          ),
          backgroundColor: 'rgba(16, 185, 129, 0.88)',
          borderRadius: 4,
          maxBarThickness: 28,
          barPercentage: 0.7,
          categoryPercentage: isSingleDay ? 0.32 : 0.72,
        },
      ],
    };
  }, [doctorReport.dayLabels, doctorReport.dailyRows]);

  const multiBarChartOptions: ChartConfiguration<'bar'>['options'] = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            title: (items) => doctorReport.dayLabels[items[0]?.dataIndex ?? 0] || '',
            afterBody: (items) => {
              const day = doctorReport.dayLabels[items[0]?.dataIndex ?? 0];
              if (!day) return '';
              const active = doctorReport.dailyRows.filter(
                (r) => r.date === day && (r.booked > 0 || r.consulted > 0)
              );
              if (active.length === 0) return '\nNo appointments';
              return ['', ...active.map((r) => `${r.name}: ${r.consulted}/${r.booked} consulted`)];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#64748B', font: { size: 11, weight: 'bold' } } },
        y: { beginAtZero: true, grace: '20%', border: { display: false }, grid: { color: '#F1F5F9' }, ticks: { precision: 0, color: '#94A3B8', font: { size: 11 } } },
      },
    }),
    [doctorReport.dayLabels, doctorReport.dailyRows]
  );

  const periodSubtitle = useMemo(() => {
    const opt = PERIOD_OPTIONS.find((p) => p.id === selectedPeriod);
    return opt ? opt.label : 'Last 30 Days';
  }, [selectedPeriod]);

  const hasAnyMonthlyFootfall = monthlyBuckets.some((m) => m.total > 0);
  const hasAnyHourlyFootfall = hourlyData.maxHourTotal > 0;

  return (
    <motion.section
      key="analytics-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pb-8 overscroll-contain"
    >
      <EcgActionLoader isLoading={isLoading} fullscreen={true} text="Loading clinic analytics..." />

      {/* Editorial Header + Tabs & Filters */}
      <div className="bg-white rounded-2xl border border-[#ECEEF2] p-6 sm:p-8 shadow-2xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
              Practice Insights • {periodSubtitle}
            </span>
            <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-semibold text-[#16191E]">
                Clinic Analytics &amp; Operations
              </h2>
              {branchName && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-[#2563EB] border border-blue-200/70">
                  {branchName}
                </span>
              )}
              {isSampleMode ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Sample preview data
                </span>
              ) : realAppointments.length === 0 ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                  No Recorded Visits Yet
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Footfall channels, case mix &amp; pharmacy valuation, queue reliability, and physician performance.
            </p>
          </div>

          {realAppointments.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setShowSamplePreview((prev) => !prev);
                resetDoctorPages();
              }}
              className={`self-start lg:self-auto px-4 py-2 rounded-full text-xs font-medium border transition cursor-pointer inline-flex items-center gap-1.5 ${
                showSamplePreview
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showSamplePreview ? 'Exit Sample Preview' : 'Preview Sample Data'}</span>
            </button>
          )}
        </div>

        <div className="pt-5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 bg-slate-50 border border-[#ECEEF2] rounded-full p-1">
            {[
              { id: 'footfall' as const, label: 'Patient Footfall' },
              { id: 'clinical' as const, label: 'Case Mix & Pharmacy' },
              { id: 'queue' as const, label: 'Queue & Bookings' },
              { id: 'doctors' as const, label: 'Doctors' },
            ].map((tabItem) => {
              const isActive = activeTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveTab(tabItem.id)}
                  className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                    isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeAnalyticsMainTab"
                      className="absolute inset-0 bg-[#2563EB] rounded-full shadow-2xs"
                      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    />
                  )}
                  <span className="relative z-10">{tabItem.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 bg-slate-50/80 border border-[#ECEEF2] rounded-full px-3.5 py-1.5 text-xs text-slate-600">
              <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                aria-label="Filter by branch"
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  resetDoctorPages();
                }}
                className="bg-transparent font-medium text-slate-700 focus:outline-hidden cursor-pointer pr-1"
              >
                <option value="">All Branches</option>
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 bg-slate-50/80 border border-[#ECEEF2] rounded-full px-3.5 py-1.5 text-xs text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                aria-label="Filter by period"
                value={String(selectedPeriod)}
                onChange={(e) => {
                  setSelectedPeriod(Number(e.target.value) as PeriodDays);
                  resetDoctorPages();
                }}
                className="bg-transparent font-medium text-slate-700 focus:outline-hidden cursor-pointer pr-1"
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 bg-slate-50/80 border border-[#ECEEF2] rounded-full px-3.5 py-1.5 text-xs text-slate-600">
              <Stethoscope className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                aria-label="Filter by doctor"
                value={selectedDoctorId}
                onChange={(e) => {
                  const nextDocId = e.target.value;
                  setSelectedDoctorId(nextDocId);
                  setOverviewDoctorId(nextDocId);
                  resetDoctorPages();
                }}
                className="bg-transparent font-medium text-slate-700 focus:outline-hidden cursor-pointer pr-1 max-w-[140px]"
              >
                <option value="">All Doctors</option>
                {activeDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-2xl bg-amber-50/90 border border-amber-200 px-5 py-3 flex items-center gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Historical database query returned a notice ({fetchError}). Showing available active queue data.</span>
        </div>
      )}

      {cleanQuery && (
        <div className="rounded-2xl bg-blue-50/80 border border-blue-200/80 px-5 py-2.5 text-xs text-blue-800 flex items-center justify-between gap-2">
          <span>
            Filtered analytics by query: <strong>&ldquo;{searchQuery}&rdquo;</strong>
          </span>
          <span className="font-medium">{activeFootfallOnly.length} matching visits</span>
        </div>
      )}

      {activeTab === 'footfall' && (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          >
            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Total Patient Visits
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                    <AnimatedCounter target={kpiMetrics.totalPatients} />
                  </span>
                  <span className="text-[11px] text-slate-400">{periodSubtitle}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] flex-wrap">
                  <span className="font-medium text-[#2563EB]">{kpiMetrics.walkinCount} Walk-in</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-emerald-600">{kpiMetrics.whatsappCount} WhatsApp</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 text-[#2563EB] flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>

            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Avg Consultation
                </span>
                <div className="flex items-baseline gap-1.5">
                  {kpiMetrics.avgDurationMins !== null ? (
                    <>
                      <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                        {kpiMetrics.avgDurationMins.toFixed(1)}
                      </span>
                      <span className="text-xs font-medium text-slate-500">min</span>
                    </>
                  ) : (
                    <span className="text-xl font-semibold text-slate-400">N/A</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 truncate">{kpiMetrics.durationLabel}</p>
              </div>
              <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>

            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-3">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                    WhatsApp Share
                  </span>
                  <span className="text-xl sm:text-2xl font-semibold text-emerald-700 tabular-nums block">
                    {kpiMetrics.whatsappSharePct}%
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {kpiMetrics.totalPatients > 0
                      ? `${kpiMetrics.whatsappCount} of ${kpiMetrics.totalPatients} visits`
                      : 'No visits recorded'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 stroke-[1.9]" />
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, kpiMetrics.whatsappSharePct))}%` }}
                />
              </div>
            </motion.div>

            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  New Patient Visits
                </span>
                <div className="flex items-baseline gap-2">
                  {kpiMetrics.newPatientVisits !== null ? (
                    <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                      <AnimatedCounter target={kpiMetrics.newPatientVisits} />
                    </span>
                  ) : (
                    <span className="text-xl font-semibold text-slate-400">N/A</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">First-time patients in period</p>
              </div>
              <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 text-[#2563EB] flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>
          </motion.div>

          {/* Branch Comparison Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs space-y-5">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                  Multi-Branch View • {periodSubtitle}
                </span>
                <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                  Branch Comparison
                </h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                {branchComparisonRows.length} {branchComparisonRows.length === 1 ? 'Branch' : 'Branches'}
              </span>
            </div>

            {branchComparisonRows.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 border-y border-slate-200/80 text-center">
                No clinic branches found.
              </p>
            ) : (
              <>
                {branchComparisonRows.length > 1 && (
                  <div className="relative w-full h-[190px]">
                    <ChartCanvas type="bar" data={branchChartData} options={branchChartOptions} showValues={true} />
                  </div>
                )}
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-t border-slate-200/80 pt-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                        <th className="py-2.5 pr-2 w-8">#</th>
                        <th className="py-2.5 px-2">Branch</th>
                        <th className="py-2.5 px-2 text-right">Visits</th>
                        <th className="py-2.5 px-2 text-right">Avg Consult</th>
                        <th className="py-2.5 pl-2 text-right">WhatsApp Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {branchComparisonRows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors whitespace-nowrap">
                          <td className="py-3 pr-2 text-xs font-medium text-slate-400 tabular-nums">
                            {String(index + 1).padStart(2, '0')}
                          </td>
                          <td className="py-3 px-2 font-medium text-[#16191E]">{row.name}</td>
                          <td className="py-3 px-2 text-right font-semibold text-[#16191E] tabular-nums">
                            {row.total.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-slate-600 tabular-nums">
                            {row.avgMins !== null ? `${row.avgMins.toFixed(1)} min` : 'N/A'}
                          </td>
                          <td className="py-3 pl-2 text-right font-medium text-emerald-600 tabular-nums">
                            {row.whatsappShare.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                    Channel Mix
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                    How Patients Booked (Walk-in vs. WhatsApp)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monthly column comparison of Walk-in visits vs. WhatsApp appointments.
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 flex items-center justify-center text-[#2563EB] flex-shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>

              <div className="relative w-full h-[260px] sm:h-[300px]">
                {hasAnyMonthlyFootfall ? (
                  <ChartCanvas type="bar" data={footfallColumnChartData} options={footfallColumnChartOptions} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                    <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-600">No monthly channel data available yet</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      Monthly Walk-in and WhatsApp counts will populate automatically as clinic visits are logged.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0">
              <div className="mb-5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                  Hourly Pattern • IST
                </span>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-[#16191E]">
                    Busiest Hours (Peak Arrival)
                  </h3>
                  {hourlyData.peakHours.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200/70">
                      <Activity className="w-3 h-3" />
                      Peak: {hourlyData.peakHours.map((p) => p.label).join(', ')} ({hourlyData.maxHourTotal} pts)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hourly arrival breakdown ({periodSubtitle}).
                </p>
              </div>

              <div className="relative w-full h-[260px] sm:h-[300px]">
                {hasAnyHourlyFootfall ? (
                  <ChartCanvas type="bar" data={peakHoursChartData} options={peakHoursChartOptions} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                    <Clock className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-600">No hourly arrival pattern in this period</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      Select a wider period or record check-ins to reveal busiest consultation hours.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                    6-Month Growth
                  </span>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-[#16191E]">
                      Patients Each Month &amp; Intake Growth
                    </h3>
                    {kpiMetrics.latestMomGrowth !== null && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                          kpiMetrics.latestMomGrowth >= 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                            : 'bg-rose-50 text-rose-700 border-rose-200/70'
                        }`}
                      >
                        {kpiMetrics.latestMomGrowth >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {kpiMetrics.latestMomGrowth >= 0 ? '+' : ''}
                        {kpiMetrics.latestMomGrowth}% MoM
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monthly patient footfall trajectory across the last 6 months.
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 flex items-center justify-center text-[#2563EB] flex-shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div className="relative w-full h-[250px] sm:h-[280px]">
                {hasAnyMonthlyFootfall ? (
                  <ChartCanvas type="line" data={monthlyTrendChartData} options={monthlyTrendChartOptions} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                    <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-600">Monthly growth curve awaiting visits</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      Month-over-month footfall growth requires recorded visits across consecutive months.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col min-w-0">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                    Monthly Breakdown
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                    Monthly Intake Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Channel counts &amp; month-over-month growth.
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>

              <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80 flex-1">
                {monthlyBuckets.map((m, idx) => (
                  <li
                    key={m.monthKey}
                    className="py-3.5 grid grid-cols-[1.75rem_1fr_auto] gap-3 items-center text-xs"
                  >
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-[#16191E] block">{m.fullLabel}</span>
                      <span className="text-[11px] text-slate-500">
                        <span className="text-[#2563EB] font-medium">{m.walkin}</span> walk-in •{' '}
                        <span className="text-emerald-600 font-medium">{m.whatsapp}</span> WhatsApp
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#16191E] tabular-nums">
                        {m.total}
                      </span>
                      {m.momGrowthPct === null ? (
                        <span className="text-[11px] text-slate-400 w-12 text-right">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${
                            m.momGrowthPct >= 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {m.momGrowthPct >= 0 ? '+' : ''}
                          {m.momGrowthPct}%
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {activeTab === 'clinical' && (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5"
          >
            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Pharmacy Revenue
                </span>
                <div className="flex items-baseline gap-2">
                  {clinicalAndPharmacy.totalRevenue !== null ? (
                    <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                      {formatINR(clinicalAndPharmacy.totalRevenue)}
                    </span>
                  ) : (
                    <span className="text-xl font-semibold text-slate-400">N/A</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {clinicalAndPharmacy.totalRevenue !== null
                    ? `${periodSubtitle} dispensed value`
                    : 'No priced dispensing logs found'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>

            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Stock Value
                </span>
                <div className="flex items-baseline gap-2">
                  {clinicalAndPharmacy.totalStockValue !== null ? (
                    <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                      {formatINR(clinicalAndPharmacy.totalStockValue)}
                    </span>
                  ) : (
                    <span className="text-xl font-semibold text-slate-400">N/A</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {clinicalAndPharmacy.totalStockValue !== null
                    ? 'At purchase / unit valuation today'
                    : 'No stock valuation prices recorded'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 text-[#2563EB] flex items-center justify-center flex-shrink-0">
                <Boxes className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>

            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Stock Turnover
                </span>
                <div className="flex items-baseline gap-2">
                  {clinicalAndPharmacy.stockTurnover !== null ? (
                    <>
                      <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums">
                        {clinicalAndPharmacy.stockTurnover.toFixed(1)}×
                      </span>
                      <span className="text-xs text-slate-400">per year</span>
                    </>
                  ) : (
                    <span className="text-xl font-semibold text-slate-400">N/A</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {clinicalAndPharmacy.stockTurnover !== null
                    ? 'At current dispensing rate'
                    : 'Requires dispensing & stock cost data'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-amber-100 bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <div className="lg:col-span-6 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                    Case Mix
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                    Common Illnesses (Diagnosis Case Mix)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clinical presentation breakdown ({periodSubtitle}).
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 flex items-center justify-center text-[#2563EB] flex-shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
              </div>

              {clinicalAndPharmacy.caseMix.length > 0 ? (
                <div className="space-y-5">
                  <div className="relative w-full h-[220px]">
                    <ChartCanvas type="doughnut" data={caseMixDoughnutData} options={caseMixDoughnutOptions} />
                  </div>
                  <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                    {clinicalAndPharmacy.caseMix.map((c, idx) => (
                      <li key={c.label} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-medium text-slate-700 truncate">{c.label}</span>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-[#16191E] tabular-nums">
                          {c.count.toLocaleString('en-IN')} visits
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="h-[260px] flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                  <Activity className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-600">No diagnosis case notes in this period</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Completed consultations with clinical notes will automatically classify the clinic case mix.
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                    Dispensation Leaders
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                    Most Sold Medicines (Units)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fast-moving formulations dispensed ({periodSubtitle}).
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 flex items-center justify-center text-[#2563EB] flex-shrink-0">
                  <Pill className="w-4 h-4" />
                </div>
              </div>

              <div className="relative w-full h-[280px] sm:h-[320px]">
                {clinicalAndPharmacy.fastMoving.length > 0 ? (
                  <ChartCanvas type="bar" data={fastMoleculesChartData} options={horizontalBarOptions} showValues={true} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                    <Pill className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-600">No dispensed medication units yet</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      Fast-moving molecules appear once prescriptions or pharmacy stock movements are recorded.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs space-y-5">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                  Valuation Summary • {periodSubtitle}
                </span>
                <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                  Pharmacy Sales &amp; Stock Valuation
                </h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                Top {Math.min(15, clinicalAndPharmacy.molecules.length)} items
              </span>
            </div>

            {clinicalAndPharmacy.molecules.length === 0 ? (
              <p className="py-8 border-y border-slate-200/80 text-center text-xs text-slate-400">
                No pharmacy sales or inventory valuation records found.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                {clinicalAndPharmacy.molecules.slice(0, 15).map((m, idx) => (
                  <li
                    key={m.name}
                    className="py-4 grid grid-cols-1 sm:grid-cols-[2rem_1.4fr_1fr_auto] gap-3 sm:gap-5 items-center text-xs"
                  >
                    <span className="text-xs font-medium text-slate-400 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium text-[#16191E] truncate">{m.name}</span>
                    <div className="flex flex-wrap items-center gap-3 text-slate-500">
                      <span>
                        Sold: <strong className="font-medium text-slate-800 tabular-nums">{m.unitsSold.toLocaleString('en-IN')} units</strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>
                        Revenue: <strong className="font-medium text-emerald-700 tabular-nums">{m.hasRevenue ? formatINR(m.revenue) : '—'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center sm:justify-end">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-0.5 text-[11px] font-medium text-slate-700 tabular-nums">
                        Stock Value: {m.hasStockValue ? formatINR(m.stockValue) : '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {activeTab === 'queue' && (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5"
          >
            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  No-Show Rate
                </span>
                <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums block">
                  {queueMetrics.noShowRate.toFixed(1)}%
                </span>
                <p className="text-xs text-slate-500 mt-1.5">
                  {queueMetrics.noShows.toLocaleString('en-IN')} of {queueMetrics.totalBookings.toLocaleString('en-IN')} bookings
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-amber-100 bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <UserX className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>

            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Cancellation Rate
                </span>
                <span className="text-xl sm:text-2xl font-semibold text-rose-600 tabular-nums block">
                  {queueMetrics.cancelRate.toFixed(1)}%
                </span>
                <p className="text-xs text-slate-500 mt-1.5">
                  {queueMetrics.cancellations.toLocaleString('en-IN')} cancelled bookings
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <CalendarX className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>

            <motion.div
              variants={fadeScale}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-2xs flex items-center justify-between min-w-0"
            >
              <div className="min-w-0 pr-3">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Late Arrivals
                </span>
                <span className="text-xl sm:text-2xl font-semibold text-[#16191E] tabular-nums block">
                  {queueMetrics.lateRate.toFixed(1)}%
                </span>
                <p className="text-xs text-slate-500 mt-1.5">
                  {queueMetrics.lateArrivedCount} late of {queueMetrics.arrivedCount} attended
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 text-[#2563EB] flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 stroke-[1.9]" />
              </div>
            </motion.div>
          </motion.div>

          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                  Queue Status • {periodSubtitle}
                </span>
                <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                  Live Queue &amp; Appointment Status
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Waiting, in progress, completed, and cancelled breakdown.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(queueMetrics.todayWaiting > 0 || queueMetrics.todayInProgress > 0) && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-[#2563EB] border border-blue-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" aria-hidden="true" />
                    {queueMetrics.todayWaiting} waiting • {queueMetrics.todayInProgress} in progress today
                  </span>
                )}
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                  {queueMetrics.totalBookings.toLocaleString('en-IN')} total
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                {queueMetrics.statusBreakdown.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[#ECEEF2] bg-slate-50/60 p-3.5 flex flex-col justify-between gap-1.5 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 truncate">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        {item.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${item.badgeClass}`}>
                        {item.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-[#16191E] tabular-nums">
                      {item.count.toLocaleString('en-IN')}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{item.note}</p>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-7 relative w-full h-[185px]">
                {queueMetrics.totalBookings > 0 ? (
                  <ChartCanvas
                    type="bar"
                    data={queueStatusChartData}
                    options={horizontalBarOptions}
                    showValues={true}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                    <Activity className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-600">No queue or booking records in this period</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <div className="lg:col-span-6 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                    Cancellation Insights
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                    Why Bookings Were Cancelled
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Logged cancellation reasons ({periodSubtitle}).
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
                  <CalendarX className="w-4 h-4" />
                </div>
              </div>

              {queueMetrics.reasons.length > 0 ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="relative w-full h-[170px]">
                    <ChartCanvas
                      type="bar"
                      data={cancelReasonsChartData}
                      options={cancelReasonsBarOptions}
                      showValues={true}
                    />
                  </div>
                  <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-t border-slate-200/80 pt-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                          <th className="py-2 pr-2">Reason</th>
                          <th className="py-2 px-2 text-right">Cancelled</th>
                          <th className="py-2 pl-2 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {queueMetrics.reasons.map((r, idx) => {
                          const totalReasons = queueMetrics.reasons.reduce((s, item) => s + item.count, 0);
                          const pct = totalReasons > 0 ? ((r.count / totalReasons) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={r.label} className="hover:bg-slate-50/80 transition-colors whitespace-nowrap">
                              <td className="py-2.5 pr-2 font-medium text-slate-700">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: CANCEL_PALETTE[idx % CANCEL_PALETTE.length] }}
                                    aria-hidden="true"
                                  />
                                  <span className="truncate max-w-[220px]" title={r.label}>
                                    {r.label}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-right font-semibold text-[#16191E] tabular-nums">
                                {r.count.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 pl-2 text-right font-medium text-rose-600 tabular-nums">
                                {pct}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                  <CalendarX className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-600">No cancellations recorded in this period</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col justify-between min-w-0 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                    Link Funnel
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                    WhatsApp Links That Became Bookings
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Booking link conversion ({periodSubtitle}).
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full border border-emerald-100 bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <Link2 className="w-4 h-4" />
                </div>
              </div>

              {queueMetrics.linksSent > 0 ? (
                <>
                  <div className="relative w-full h-[180px]">
                    <ChartCanvas type="bar" data={waConversionChartData} options={horizontalBarOptions} showValues={true} />
                  </div>
                  <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80 text-xs">
                    <li className="py-3 flex items-center justify-between">
                      <span className="font-medium text-slate-700">Links Sent</span>
                      <span className="font-semibold text-[#16191E] tabular-nums">
                        {queueMetrics.linksSent.toLocaleString('en-IN')}
                      </span>
                    </li>
                    <li className="py-3 flex items-center justify-between">
                      <span className="font-medium text-slate-700">Bookings Made</span>
                      <span className="font-semibold text-[#16191E] tabular-nums">
                        {queueMetrics.linkBookings.toLocaleString('en-IN')}
                      </span>
                    </li>
                    <li className="py-3 flex items-center justify-between">
                      <span className="font-medium text-slate-700">Conversion Rate</span>
                      <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 tabular-nums">
                        {queueMetrics.waConversion.toFixed(1)}%
                      </span>
                    </li>
                  </ul>
                </>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                  <Link2 className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-600">No WhatsApp booking link logs in this period</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                  Quota Utilization • {periodSubtitle}
                </span>
                <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                  How Full Each Doctor&apos;s Day Is (%, All Branches)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily appointment bookings vs. configured physician daily quota.
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50 flex items-center justify-center text-[#2563EB] flex-shrink-0">
                <Gauge className="w-4 h-4" />
              </div>
            </div>

            {queueMetrics.quotaRows.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border-y border-slate-200/80">
                No active doctors configured to compute daily quota utilization.
              </div>
            ) : (
              <>
                <div className="relative w-full h-[230px]">
                  <ChartCanvas type="bar" data={doctorQuotaChartData} options={branchChartOptions} showValues={true} />
                </div>
                <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                  {pagedDoctorQuota.rows.map((q, idx) => (
                    <li
                      key={q.id}
                      className="py-4 grid grid-cols-1 sm:grid-cols-[2rem_1.3fr_1fr_auto] gap-3 sm:gap-5 items-center text-xs"
                    >
                      <span className="text-xs font-medium text-slate-400 tabular-nums">
                        {String(pagedDoctorQuota.startIndex + idx).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium text-[#16191E] truncate">{q.name}</span>
                      <div className="flex flex-wrap items-center gap-3 text-slate-500">
                        <span>
                          Daily Quota: <strong className="font-medium text-slate-800 tabular-nums">{q.dailyQuota}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Avg / Day: <strong className="font-medium text-slate-800 tabular-nums">{q.perDay.toFixed(1)}</strong>
                        </span>
                      </div>
                      <div className="flex items-center sm:justify-end">
                        <span className="rounded-full border border-blue-200/70 bg-blue-50 px-3 py-0.5 text-[11px] font-medium text-[#2563EB] tabular-nums">
                          {q.usedPct.toFixed(1)}% Used
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <DoctorTablePagination
                  currentPage={pagedDoctorQuota.currentPage}
                  totalPages={pagedDoctorQuota.totalPages}
                  totalItems={queueMetrics.quotaRows.length}
                  startIndex={pagedDoctorQuota.startIndex}
                  endIndex={pagedDoctorQuota.endIndex}
                  itemName="doctors"
                  onPageChange={setDoctorQuotaPage}
                />
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'doctors' && (
        <>
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs space-y-5">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                  Physician Throughput • {periodSubtitle}
                </span>
                <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                  Branch Distribution &amp; Time Workload
                </h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                {doctorReport.summary.length} {doctorReport.summary.length === 1 ? 'Doctor' : 'Doctors'}
              </span>
            </div>

            {doctorReport.summary.length === 0 ? (
              <p className="py-8 border-y border-slate-200/80 text-center text-xs text-slate-400">
                No doctor activity found for the selected filters.
              </p>
            ) : (
              <>
                <div className="relative w-full h-[175px]">
                  <ChartCanvas
                    type="bar"
                    data={doctorPatientsBranchChartData}
                    options={doctorPatientsChartOptions}
                    showValues={true}
                  />
                </div>

                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-t border-slate-200/80 pt-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                        <th className="py-2.5 pr-2 w-8">#</th>
                        <th className="py-2.5 px-2">Doctor</th>
                        <th className="py-2.5 px-2 text-right">Consulted</th>
                        {doctorReport.branchNames.map((bn) => (
                          <th key={bn} title={bn} className="py-2.5 px-2 text-right">
                            <span className="inline-block max-w-[115px] truncate align-bottom">
                              {formatCompactBranchHeader(bn, doctorReport.branchNames)}
                            </span>
                          </th>
                        ))}
                        <th className="py-2.5 px-2 text-right">Total Time</th>
                        <th className="py-2.5 px-2 text-right">Avg / Patient</th>
                        <th className="py-2.5 pl-2 text-right">Leaves</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {pagedDoctorSummary.rows.map((d, idx) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition-colors whitespace-nowrap">
                          <td className="py-3 pr-2 text-xs font-medium text-slate-400 tabular-nums">
                            {String(pagedDoctorSummary.startIndex + idx).padStart(2, '0')}
                          </td>
                          <td className="py-3 px-2 font-medium text-[#16191E]">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: d.color }}
                                aria-hidden="true"
                              />
                              <span>{d.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-slate-800 tabular-nums">
                            {d.consulted.toLocaleString('en-IN')}
                          </td>
                          {d.byBranch.map((cnt, bIdx) => (
                            <td key={`${d.id}-br-${bIdx}`} className="py-3 px-2 text-right text-slate-600 tabular-nums">
                              {cnt.toLocaleString('en-IN')}
                            </td>
                          ))}
                          <td className="py-3 px-2 text-right text-slate-600 tabular-nums">
                            {d.totalMins !== null ? formatHoursMins(d.totalMins) : 'N/A'}
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-[#2563EB] tabular-nums">
                            {d.avgMins !== null ? `${d.avgMins.toFixed(1)} min` : 'N/A'}
                          </td>
                          <td className="py-3 pl-2 text-right font-medium text-amber-600 tabular-nums">
                            {d.leaveDays}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <DoctorTablePagination
                  currentPage={pagedDoctorSummary.currentPage}
                  totalPages={pagedDoctorSummary.totalPages}
                  totalItems={doctorReport.summary.length}
                  startIndex={pagedDoctorSummary.startIndex}
                  endIndex={pagedDoctorSummary.endIndex}
                  itemName="doctors"
                  onPageChange={setDoctorSummaryPage}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            <div className="lg:col-span-6 h-full bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col gap-4 min-w-0">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                      Daily Activity
                    </span>
                    <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                      Appointment Overview
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="flex items-center gap-1.5 bg-slate-50 border border-[#ECEEF2] rounded-full px-3 py-1 text-[11px] text-slate-600">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <select
                        aria-label="Filter Appointment Overview by doctor"
                        value={overviewDoctorId}
                        onChange={(e) => {
                          setOverviewDoctorId(e.target.value);
                          setDoctorDailyPage(1);
                        }}
                        className="bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer max-w-[130px] text-[11px]"
                      >
                        <option value="">All Doctors</option>
                        {activeDoctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <input
                      type="date"
                      aria-label="Filter Appointment Overview by date"
                      value={overviewDateFilter}
                      max={todayIST}
                      onChange={(e) => {
                        setOverviewDateFilter(e.target.value);
                        setDoctorDailyPage(1);
                      }}
                      className="bg-slate-50 border border-[#ECEEF2] rounded-full px-3 py-1 font-medium text-slate-700 focus:outline-hidden cursor-pointer text-[11px]"
                    />
                    {overviewDateFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setOverviewDateFilter('');
                          setDoctorDailyPage(1);
                        }}
                        aria-label="Clear appointment overview date filter"
                        title="Show last 7 days"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] text-slate-600 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>7D</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{overviewDateFilter ? `Showing ${overviewDateFilter}` : 'Last 7 Days'}</span>
                  <div className="flex items-center gap-3 text-slate-600 text-[11px] font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
                      Booked
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" aria-hidden="true" />
                      Consulted
                    </span>
                  </div>
                </div>
              </div>

              {doctorReport.dailyRows.length === 0 ? (
                <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6">
                  <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-600">
                    {overviewDateFilter
                      ? `No appointment overview data for ${overviewDateFilter}.`
                      : 'No 7-day doctor data available.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative w-full h-[165px]">
                    <ChartCanvas
                      type="bar"
                      data={doctorBookedVsSeenChartData}
                      options={multiBarChartOptions}
                      showValues={true}
                    />
                  </div>
                  <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80 flex-1">
                    {pagedDoctorDaily.rows.map((d) => (
                      <li
                        key={`${d.date}-${d.doctorId}`}
                        className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: d.color }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <span className="font-medium text-[#16191E] block truncate">{d.name}</span>
                            <span className="text-[11px] text-slate-400 tabular-nums">{d.date}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <span className="text-xs font-medium text-slate-700 tabular-nums">
                            {d.consulted}/{d.booked}
                          </span>
                          <span className="text-[11px] font-medium text-[#2563EB] tabular-nums">
                            {d.avgMins !== null ? `${d.avgMins.toFixed(1)}m` : '—'}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              d.onLeave
                                ? 'bg-amber-50 text-amber-800 border-amber-200/70'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                            }`}
                          >
                            {d.onLeave ? 'On Leave' : 'Working'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <DoctorTablePagination
                    currentPage={pagedDoctorDaily.currentPage}
                    totalPages={pagedDoctorDaily.totalPages}
                    totalItems={doctorReport.dailyRows.length}
                    startIndex={pagedDoctorDaily.startIndex}
                    endIndex={pagedDoctorDaily.endIndex}
                    itemName="entries"
                    onPageChange={setDoctorDailyPage}
                  />
                </>
              )}
            </div>

            <div className="lg:col-span-6 h-full bg-white rounded-2xl p-6 sm:p-7 border border-[#ECEEF2] shadow-2xs flex flex-col gap-4 min-w-0">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">
                    Leave Schedule
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[#16191E]">
                    Doctor Leave Days
                  </h3>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                  {doctorReport.leaves.length} logs
                </span>
              </div>

              {doctorReport.leaves.length === 0 ? (
                <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-5">
                  <Calendar className="w-7 h-7 text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-600">No doctor leave days recorded.</p>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-slate-200/80 border-y border-slate-200/80 flex-1">
                    {pagedDoctorLeaves.rows.map((l, idx) => (
                      <li
                        key={`${l.dateKey}-${l.doctorId}-${l.type}-${pagedDoctorLeaves.startIndex + idx}`}
                        className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: l.color }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <span className="font-medium text-[#16191E] block truncate">{l.doctorName}</span>
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              {l.dateKey} • {l.type}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                            l.upcoming
                              ? 'bg-blue-50 text-[#2563EB] border-blue-200/70'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {l.upcoming ? 'Upcoming' : 'Taken'}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <DoctorTablePagination
                    currentPage={pagedDoctorLeaves.currentPage}
                    totalPages={pagedDoctorLeaves.totalPages}
                    totalItems={doctorReport.leaves.length}
                    startIndex={pagedDoctorLeaves.startIndex}
                    endIndex={pagedDoctorLeaves.endIndex}
                    itemName="logs"
                    onPageChange={setDoctorLeavesPage}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </motion.section>
  );
}

export default AnalyticsView;
 