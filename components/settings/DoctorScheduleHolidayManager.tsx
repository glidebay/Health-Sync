'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Sun,
  Moon,
  Info,
  Check,
  RotateCcw,
  Sparkles,
  UserCheck,
  Building,
  Timer,
  CalendarCheck,
} from 'lucide-react';
import {
  DaySchedule,
  DoctorShift,
  ClinicHoliday,
  QuotaOverride,
  SLOT_DURATIONS,
  BUFFER_TIMES,
  DEFAULT_WEEKLY_SCHEDULE,
  DEFAULT_HOLIDAYS,
  DEFAULT_OVERRIDES,
  fetchWeeklyShifts,
  saveWeeklyShifts,
  fetchClinicHolidays,
  saveClinicHolidays,
  fetchQuotaOverrides,
  saveQuotaOverrides,
  calculateShiftSlots,
  checkShiftOverlap,
} from '@/lib/scheduleHolidayService';
import { getDoctors } from '@/lib/supabaseService';
import { DbDoctor } from '@/types/database';

export function DoctorScheduleHolidayManager() {
  const [activeTab, setActiveTab] = useState<'shifts' | 'calendar' | 'overrides'>('shifts');

  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(DEFAULT_WEEKLY_SCHEDULE);
  const [holidays, setHolidays] = useState<ClinicHoliday[]>(DEFAULT_HOLIDAYS);
  const [quotaOverrides, setQuotaOverrides] = useState<QuotaOverride[]>(DEFAULT_OVERRIDES);
  const [doctors, setDoctors] = useState<DbDoctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(2026, 10, 1));
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<ClinicHoliday | null>(null);
  const [holidayFormDate, setHolidayFormDate] = useState('');
  const [holidayFormName, setHolidayFormName] = useState('');
  const [holidayFormDesc, setHolidayFormDesc] = useState('');
  const [holidayFormType, setHolidayFormType] = useState<'full-day' | 'partial-day'>('full-day');
  const [holidayFormStart, setHolidayFormStart] = useState('14:00');
  const [holidayFormEnd, setHolidayFormEnd] = useState('18:00');
  const [holidayFormError, setHolidayFormError] = useState('');
  const [holidayToDelete, setHolidayToDelete] = useState<ClinicHoliday | null>(null);

  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<QuotaOverride | null>(null);
  const [overrideFormDoctorId, setOverrideFormDoctorId] = useState('');
  const [overrideFormDate, setOverrideFormDate] = useState('');
  const [overrideFormQuota, setOverrideFormQuota] = useState(40);
  const [overrideFormReason, setOverrideFormReason] = useState('');
  const [overrideFormError, setOverrideFormError] = useState('');
  const [overrideToDelete, setOverrideToDelete] = useState<QuotaOverride | null>(null);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [shiftsData, holidaysData, overridesData, docsData] = await Promise.all([
        fetchWeeklyShifts(),
        fetchClinicHolidays(),
        fetchQuotaOverrides(),
        getDoctors(),
      ]);

      setWeeklySchedule(shiftsData);
      setHolidays(holidaysData);
      setQuotaOverrides(overridesData);
      setDoctors(docsData);

      if (docsData.length > 0 && !overrideFormDoctorId) {
        setOverrideFormDoctorId(docsData[0].id);
      }
    } catch (err) {
      console.warn('Error loading schedule & holiday data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [overrideFormDoctorId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const totalWeeklyCapacity = useMemo(() => {
    return weeklySchedule.reduce((acc, day) => {
      if (!day.isEnabled) return acc;
      const daySlots = day.shifts.reduce((sAcc, s) => sAcc + calculateShiftSlots(s), 0);
      return acc + daySlots;
    }, 0);
  }, [weeklySchedule]);

  const activeDaysCount = useMemo(() => {
    return weeklySchedule.filter((d) => d.isEnabled).length;
  }, [weeklySchedule]);

  const handleToggleDay = (dayOfWeek: number) => {
    setWeeklySchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, isEnabled: !day.isEnabled } : day
      )
    );
  };

  const handleUpdateShift = (
    dayOfWeek: number,
    shiftId: string,
    updates: Partial<DoctorShift>
  ) => {
    setWeeklySchedule((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        return {
          ...day,
          shifts: day.shifts.map((s) => (s.id === shiftId ? { ...s, ...updates } : s)),
        };
      })
    );
  };

  const handleAddShift = (dayOfWeek: number) => {
    setWeeklySchedule((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        const count = day.shifts.length;
        const newShift: DoctorShift = {
          id: `${day.dayName.toLowerCase().slice(0, 3)}-${Date.now()}`,
          name: count === 0 ? 'Morning OPD' : count === 1 ? 'Evening Clinic' : `Session ${count + 1}`,
          startTime: count === 0 ? '09:00' : '17:00',
          endTime: count === 0 ? '13:00' : '20:00',
          slotDurationMins: 15,
          bufferMins: 5,
        };
        return { ...day, shifts: [...day.shifts, newShift] };
      })
    );
  };

  const handleRemoveShift = (dayOfWeek: number, shiftId: string) => {
    setWeeklySchedule((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        return {
          ...day,
          shifts: day.shifts.filter((s) => s.id !== shiftId),
        };
      })
    );
  };

  const handleSaveShifts = async () => {
    for (const day of weeklySchedule) {
      if (!day.isEnabled) continue;
      for (const shift of day.shifts) {
        if (shift.startTime >= shift.endTime) {
          showToast('error', `Invalid timings in ${day.dayName} (${shift.name}): End time must be after Start time.`);
          return;
        }
      }
      for (let i = 0; i < day.shifts.length; i++) {
        for (let j = i + 1; j < day.shifts.length; j++) {
          if (checkShiftOverlap(day.shifts[i], [day.shifts[j]])) {
            showToast('error', `Shift overlap detected on ${day.dayName} between "${day.shifts[i].name}" and "${day.shifts[j].name}".`);
            return;
          }
        }
      }
    }

    setIsSaving(true);
    const res = await saveWeeklyShifts(weeklySchedule);
    setIsSaving(false);
    if (res.success) {
      showToast('success', 'Weekly shift matrix saved successfully to clinic database.');
    } else {
      showToast('error', res.error || 'Failed to save weekly shifts.');
    }
  };

  const handleResetShiftsToDefault = () => {
    if (window.confirm('Reset weekly shifts to standard clinic presets (Mon-Sat 9-13 & 16:30-20, Sun off)?')) {
      setWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE);
      saveWeeklyShifts(DEFAULT_WEEKLY_SCHEDULE);
      showToast('success', 'Weekly shifts reverted to standard clinic presets.');
    }
  };

  const calendarYear = currentMonth.getFullYear();
  const calendarMonthIndex = currentMonth.getMonth();

  const monthName = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCurrentMonth(new Date(calendarYear, calendarMonthIndex - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(calendarYear, calendarMonthIndex + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  };

  const calendarGridDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonthIndex, 1);
    const lastDay = new Date(calendarYear, calendarMonthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startingDayIndex = firstDay.getDay() - 1;
    if (startingDayIndex === -1) startingDayIndex = 6;

    const days: ({
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      holiday?: ClinicHoliday;
      overrides: QuotaOverride[];
      isNonWorkingDay: boolean;
    } | null)[] = [];

    for (let i = 0; i < startingDayIndex; i++) {
      days.push(null);
    }

    const todayStr = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(calendarYear, calendarMonthIndex, d);
      let jsDay = dayDate.getDay();
      const scheduleDayNum = jsDay === 0 ? 7 : jsDay;
      const daySchedule = weeklySchedule.find((w) => w.dayOfWeek === scheduleDayNum);
      const isNonWorkingDay = !daySchedule || !daySchedule.isEnabled;

      const holiday = holidays.find((h) => h.date === dateStr);
      const dayOverrides = quotaOverrides.filter((o) => o.date === dateStr);

      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        holiday,
        overrides: dayOverrides,
        isNonWorkingDay,
      });
    }

    return days;
  }, [calendarYear, calendarMonthIndex, holidays, quotaOverrides, weeklySchedule]);

  const selectedDateHoliday = useMemo(() => {
    return holidays.find((h) => h.date === selectedDate);
  }, [holidays, selectedDate]);

  const selectedDateOverrides = useMemo(() => {
    return quotaOverrides.filter((o) => o.date === selectedDate);
  }, [quotaOverrides, selectedDate]);

  const selectedDateSchedule = useMemo(() => {
    if (!selectedDate) return undefined;
    const parts = selectedDate.split('-');
    if (parts.length !== 3) return undefined;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    let jsDay = d.getDay();
    const dayNum = jsDay === 0 ? 7 : jsDay;
    return weeklySchedule.find((w) => w.dayOfWeek === dayNum);
  }, [selectedDate, weeklySchedule]);

  const handleOpenAddHoliday = (prefillDate?: string) => {
    setEditingHoliday(null);
    setHolidayFormDate(prefillDate || selectedDate || '2026-11-26');
    setHolidayFormName('');
    setHolidayFormDesc('');
    setHolidayFormType('full-day');
    setHolidayFormStart('14:00');
    setHolidayFormEnd('18:00');
    setHolidayFormError('');
    setIsHolidayModalOpen(true);
  };

  const handleOpenEditHoliday = (hol: ClinicHoliday) => {
    setEditingHoliday(hol);
    setHolidayFormDate(hol.date);
    setHolidayFormName(hol.name);
    setHolidayFormDesc(hol.description || '');
    setHolidayFormType(hol.type);
    setHolidayFormStart(hol.startTime || '14:00');
    setHolidayFormEnd(hol.endTime || '18:00');
    setHolidayFormError('');
    setIsHolidayModalOpen(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayFormError('');

    if (!holidayFormDate) {
      setHolidayFormError('Please select a valid holiday date.');
      return;
    }
    if (!holidayFormName.trim()) {
      setHolidayFormError('Holiday name or occasion description is required.');
      return;
    }
    if (holidayFormType === 'partial-day') {
      if (!holidayFormStart || !holidayFormEnd) {
        setHolidayFormError('Please specify both start and end times for partial-day holiday.');
        return;
      }
      if (holidayFormStart >= holidayFormEnd) {
        setHolidayFormError('Partial-day end time must be later than start time.');
        return;
      }
    }

    const newHoliday: ClinicHoliday = {
      id: editingHoliday ? editingHoliday.id : `hol-${Date.now()}`,
      date: holidayFormDate,
      name: holidayFormName.trim(),
      description: holidayFormDesc.trim() || undefined,
      type: holidayFormType,
      startTime: holidayFormType === 'partial-day' ? holidayFormStart : undefined,
      endTime: holidayFormType === 'partial-day' ? holidayFormEnd : undefined,
      createdAt: editingHoliday?.createdAt || new Date().toISOString(),
    };

    let updatedList: ClinicHoliday[];
    if (editingHoliday) {
      updatedList = holidays.map((h) => (h.id === editingHoliday.id ? newHoliday : h));
    } else {
      updatedList = [...holidays.filter((h) => h.id !== newHoliday.id), newHoliday];
    }

    setHolidays(updatedList);
    setIsHolidayModalOpen(false);
    const res = await saveClinicHolidays(updatedList);
    if (res.success) {
      showToast('success', editingHoliday ? 'Holiday updated successfully.' : 'New holiday added to clinic calendar.');
    } else {
      showToast('error', res.error || 'Failed to persist holiday.');
    }
  };

  const handleDeleteHoliday = async (hol: ClinicHoliday) => {
    const updated = holidays.filter((h) => h.id !== hol.id);
    setHolidays(updated);
    setHolidayToDelete(null);
    const res = await saveClinicHolidays(updated);
    if (res.success) {
      showToast('success', `Holiday "${hol.name}" removed from calendar.`);
    } else {
      showToast('error', res.error || 'Failed to delete holiday.');
    }
  };

  const handleOpenAddOverride = (prefillDate?: string) => {
    setEditingOverride(null);
    setOverrideFormDoctorId(doctors[0]?.id || 'doc-default');
    setOverrideFormDate(prefillDate || selectedDate || '2026-11-14');
    setOverrideFormQuota(doctors[0]?.daily_quota || 40);
    setOverrideFormReason('');
    setOverrideFormError('');
    setIsOverrideModalOpen(true);
  };

  const handleOpenEditOverride = (ovr: QuotaOverride) => {
    setEditingOverride(ovr);
    setOverrideFormDoctorId(ovr.doctorId);
    setOverrideFormDate(ovr.date);
    setOverrideFormQuota(ovr.customQuota);
    setOverrideFormReason(ovr.reason || '');
    setOverrideFormError('');
    setIsOverrideModalOpen(true);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideFormError('');

    if (!overrideFormDoctorId) {
      setOverrideFormError('Please select a doctor.');
      return;
    }
    if (!overrideFormDate) {
      setOverrideFormError('Please select an override date.');
      return;
    }
    if (overrideFormQuota < 1 || overrideFormQuota > 200) {
      setOverrideFormError('Custom quota must be between 1 and 200 patients.');
      return;
    }

    const matchedDoc = doctors.find((d) => d.id === overrideFormDoctorId);
    const doctorName = matchedDoc ? matchedDoc.full_name : 'Dr. Attending';

    const newOverride: QuotaOverride = {
      id: editingOverride ? editingOverride.id : `ovr-${Date.now()}`,
      doctorId: overrideFormDoctorId,
      doctorName,
      date: overrideFormDate,
      customQuota: overrideFormQuota,
      reason: overrideFormReason.trim() || undefined,
      createdAt: editingOverride?.createdAt || new Date().toISOString(),
    };

    let updatedList: QuotaOverride[];
    if (editingOverride) {
      updatedList = quotaOverrides.map((o) => (o.id === editingOverride.id ? newOverride : o));
    } else {
      updatedList = [
        ...quotaOverrides.filter((o) => !(o.doctorId === newOverride.doctorId && o.date === newOverride.date)),
        newOverride,
      ];
    }

    setQuotaOverrides(updatedList);
    setIsOverrideModalOpen(false);
    const res = await saveQuotaOverrides(updatedList);
    if (res.success) {
      showToast('success', editingOverride ? 'Quota override updated.' : `Date quota overridden for ${doctorName}.`);
    } else {
      showToast('error', res.error || 'Failed to save quota override.');
    }
  };

  const handleDeleteOverride = async (ovr: QuotaOverride) => {
    const updated = quotaOverrides.filter((o) => o.id !== ovr.id);
    setQuotaOverrides(updated);
    setOverrideToDelete(null);
    const res = await saveQuotaOverrides(updated);
    if (res.success) {
      showToast('success', `Quota override for ${ovr.doctorName} on ${ovr.date} removed.`);
    } else {
      showToast('error', res.error || 'Failed to delete quota override.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10'
                : 'bg-rose-50 text-rose-800 border-rose-200 shadow-rose-500/10'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header & Sub-Tab Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                  Weekly Shift Matrix &amp; Holiday Calendar
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {activeDaysCount} Days Active • {totalWeeklyCapacity} Slots/Wk
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Configure doctor chamber shifts, multi-session consultation hours, slot &amp; buffer times, clinic holidays, and date-specific quotas.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl self-start md:self-auto border border-slate-200/50">
          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'shifts'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Weekly Shift Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Holiday Calendar</span>
            {holidays.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded-full text-[9px] font-extrabold">
                {holidays.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overrides')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'overrides'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Quota Overrides</span>
            {quotaOverrides.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-[9px] font-extrabold">
                {quotaOverrides.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: WEEKLY SHIFT MATRIX */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/50 border border-blue-100/80 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Timer className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Operational Consultation Capacity</h4>
                <p className="text-[11px] text-slate-500">
                  Total of <span className="font-bold text-blue-700">{totalWeeklyCapacity} weekly appointment slots</span> across{' '}
                  <span className="font-bold text-blue-700">{activeDaysCount} working days</span>. Overlapping shifts are prevented automatically.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleResetShiftsToDefault}
                className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition cursor-pointer"
                title="Reset to clinic presets"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Presets</span>
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleSaveShifts}
                disabled={isSaving}
                className="flex items-center space-x-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Weekly Schedule</span>
              </motion.button>
            </div>
          </div>

          {/* Days List (Monday to Sunday) */}
          <div className="space-y-3.5">
            {weeklySchedule.map((day) => {
              const daySlots = day.isEnabled
                ? day.shifts.reduce((acc, s) => acc + calculateShiftSlots(s), 0)
                : 0;

              return (
                <div
                  key={day.dayOfWeek}
                  className={`bg-white rounded-2xl border transition-all ${
                    day.isEnabled
                      ? 'border-slate-200/80 shadow-[0_10px_25px_0_rgba(0,0,0,0.02)]'
                      : 'border-slate-100 bg-slate-50/50 opacity-80'
                  }`}
                >
                  {/* Day Header Row */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      {/* Day Enable/Disable Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleDay(day.dayOfWeek)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer p-0.5 shadow-2xs flex-shrink-0 ${
                          day.isEnabled ? 'bg-[#2563EB]' : 'bg-slate-300'
                        }`}
                        title={day.isEnabled ? 'Disable day' : 'Enable day'}
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', damping: 25, stiffness: 500 }}
                          className={`block h-5 w-5 rounded-full bg-white shadow-xs ${
                            day.isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{day.dayName}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              day.isEnabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {day.isEnabled ? 'Working Day' : 'Non-Working (Chamber Closed)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {day.isEnabled
                            ? `${day.shifts.length} ${day.shifts.length === 1 ? 'shift configured' : 'shifts configured'} • Approx ${daySlots} available patient slots`
                            : 'Chamber closed on this day. Appointments cannot be scheduled.'}
                        </p>
                      </div>
                    </div>

                    {day.isEnabled && (
                      <div className="flex items-center space-x-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleAddShift(day.dayOfWeek)}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Shift</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Day Shifts Content */}
                  {day.isEnabled && (
                    <div className="p-4 sm:p-5 space-y-3">
                      {day.shifts.length === 0 ? (
                        <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <p className="text-xs text-slate-500">No shifts configured for {day.dayName}.</p>
                          <button
                            type="button"
                            onClick={() => handleAddShift(day.dayOfWeek)}
                            className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add first shift
                          </button>
                        </div>
                      ) : (
                        day.shifts.map((shift, idx) => {
                          const slots = calculateShiftSlots(shift);
                          const isInvalidTime = shift.startTime >= shift.endTime;
                          const hasOverlap = checkShiftOverlap(shift, day.shifts, shift.id);

                          return (
                            <div
                              key={shift.id}
                              className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                                isInvalidTime || hasOverlap
                                  ? 'bg-rose-50/40 border-rose-200'
                                  : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-50'
                              }`}
                            >
                              {/* Shift Header Row */}
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={shift.name}
                                    onChange={(e) =>
                                      handleUpdateShift(day.dayOfWeek, shift.id, { name: e.target.value })
                                    }
                                    placeholder="e.g. Morning OPD"
                                    className="text-xs font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-0.5"
                                  />
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 shadow-2xs">
                                    {slots} Slots ({shift.slotDurationMins}m + {shift.bufferMins}m buf)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveShift(day.dayOfWeek, shift.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Delete this shift"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Controls Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {/* Start Time */}
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Start Time
                                  </label>
                                  <input
                                    type="time"
                                    value={shift.startTime}
                                    onChange={(e) =>
                                      handleUpdateShift(day.dayOfWeek, shift.id, { startTime: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                {/* End Time */}
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    End Time
                                  </label>
                                  <input
                                    type="time"
                                    value={shift.endTime}
                                    onChange={(e) =>
                                      handleUpdateShift(day.dayOfWeek, shift.id, { endTime: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                {/* Slot Duration */}
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Slot Duration
                                  </label>
                                  <select
                                    value={shift.slotDurationMins}
                                    onChange={(e) =>
                                      handleUpdateShift(day.dayOfWeek, shift.id, {
                                        slotDurationMins: Number(e.target.value),
                                      })
                                    }
                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                  >
                                    {SLOT_DURATIONS.map((dur) => (
                                      <option key={dur} value={dur}>
                                        {dur} minutes
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Buffer Time */}
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Buffer Gap
                                  </label>
                                  <select
                                    value={shift.bufferMins}
                                    onChange={(e) =>
                                      handleUpdateShift(day.dayOfWeek, shift.id, {
                                        bufferMins: Number(e.target.value),
                                      })
                                    }
                                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                  >
                                    {BUFFER_TIMES.map((b) => (
                                      <option key={b} value={b}>
                                        {b === 0 ? 'No buffer (0m)' : `${b} mins buffer`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Error Indicators */}
                              {isInvalidTime && (
                                <p className="text-[11px] font-bold text-rose-600 mt-2 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  Shift End Time must be later than Start Time.
                                </p>
                              )}
                              {hasOverlap && (
                                <p className="text-[11px] font-bold text-rose-600 mt-2 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  Shift timing overlaps with another shift on {day.dayName}.
                                </p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: HOLIDAY CALENDAR */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Calendar Navigation & Quick Actions Bar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 bg-slate-100 rounded-xl p-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-800">{monthName}</h3>
                <span className="text-[11px] text-slate-400">Click any date to inspect, add a holiday or quota override</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => handleOpenAddHoliday()}
                className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Holiday</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => handleOpenAddOverride()}
                className="flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Override Quota</span>
              </motion.button>
            </div>
          </div>

          {/* Monthly Calendar Grid */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]">
            {/* Day of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-[11px] font-bold py-1 ${
                    i >= 5 ? 'text-amber-700/80' : 'text-slate-500'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Month Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarGridDays.map((cell, idx) => {
                if (!cell) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[75px] sm:min-h-[90px] rounded-xl bg-slate-50/30 border border-transparent"
                    />
                  );
                }

                const isSelected = cell.dateStr === selectedDate;
                const hasHoliday = Boolean(cell.holiday);
                const hasOverrides = cell.overrides.length > 0;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`min-h-[75px] sm:min-h-[95px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/30 shadow-xs ring-1 ring-blue-500'
                        : hasHoliday
                        ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
                        : cell.isNonWorkingDay
                        ? 'border-slate-100 bg-slate-50/70 hover:border-slate-200'
                        : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Date Number & Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold rounded-md px-1.5 py-0.5 ${
                          cell.isToday
                            ? 'bg-blue-600 text-white'
                            : isSelected
                            ? 'text-blue-700 bg-blue-100'
                            : cell.isNonWorkingDay
                            ? 'text-slate-400'
                            : 'text-slate-800'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {cell.isToday && (
                        <span className="hidden sm:inline text-[9px] font-extrabold text-blue-600 uppercase">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Indicators Body */}
                    <div className="space-y-1 mt-1">
                      {cell.holiday && (
                        <div
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200 truncate"
                          title={`${cell.holiday.name} (${cell.holiday.type})`}
                        >
                          🎉 {cell.holiday.name}
                        </div>
                      )}

                      {cell.overrides.map((ovr) => (
                        <div
                          key={ovr.id}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 truncate"
                          title={`${ovr.doctorName}: ${ovr.customQuota} pts`}
                        >
                          ⚡ {ovr.doctorName.split(' ')[1] || ovr.doctorName}: {ovr.customQuota}
                        </div>
                      ))}

                      {cell.isNonWorkingDay && !cell.holiday && (
                        <span className="text-[9px] font-semibold text-slate-400 block truncate">
                          Chamber Off
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Details Panel */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Selected Chamber Date
                </span>
                <h4 className="text-sm font-bold text-slate-800 mt-0.5">
                  {new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h4>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleOpenAddHoliday(selectedDate)}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Holiday on this Date</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddOverride(selectedDate)}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition cursor-pointer inline-flex items-center gap-1"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Override Quota</span>
                </button>
              </div>
            </div>

            {/* Date Details Breakdown */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Working Hours / Shift Schedule */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Day Schedule Matrix
                </span>
                {selectedDateSchedule?.isEnabled ? (
                  <div>
                    <span className="text-xs font-bold text-emerald-700 block">
                      Active Chamber Working Day
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {selectedDateSchedule.shifts.map((s) => (
                        <div key={s.id} className="text-[11px] text-slate-600 font-medium">
                          • {s.name}: <span className="font-bold">{s.startTime} – {s.endTime}</span> ({calculateShiftSlots(s)} slots)
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-400">
                    Chamber closed by weekly shift matrix.
                  </p>
                )}
              </div>

              {/* Holiday Status on Date */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Holiday / Exception Status
                </span>
                {selectedDateHoliday ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-700">
                        {selectedDateHoliday.name}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditHoliday(selectedDateHoliday)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHolidayToDelete(selectedDateHoliday)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                      {selectedDateHoliday.type === 'full-day'
                        ? 'Chamber fully closed all day.'
                        : `Partial Closure: ${selectedDateHoliday.startTime} to ${selectedDateHoliday.endTime}`}
                    </span>
                    {selectedDateHoliday.description && (
                      <p className="text-[10px] text-slate-400 mt-1 italic">
                        {selectedDateHoliday.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-slate-400">
                    No holiday scheduled for this date.
                  </p>
                )}
              </div>

              {/* Quota Overrides on Date */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Doctor Quota Overrides
                </span>
                {selectedDateOverrides.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedDateOverrides.map((ovr) => (
                      <div
                        key={ovr.id}
                        className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 shadow-2xs"
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {ovr.doctorName}
                          </span>
                          <span className="text-[10px] text-indigo-600 font-extrabold">
                            Custom Quota: {ovr.customQuota} patients
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditOverride(ovr)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverrideToDelete(ovr)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-slate-400">
                    Standard doctor daily quotas apply.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Scheduled Holidays List */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Scheduled Clinic Holidays</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Full and partial closure dates recorded for clinical staff and patient booking protection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddHoliday()}
                className="flex items-center space-x-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Holiday</span>
              </button>
            </div>

            {holidays.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No clinic holidays registered.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {holidays.map((hol) => (
                  <div
                    key={hol.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{hol.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            hol.type === 'full-day'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {hol.type === 'full-day' ? 'Full Day' : `${hol.startTime} - ${hol.endTime}`}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-600 block mt-1">
                        📅 {hol.date}
                      </span>
                      {hol.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{hol.description}</p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-end space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditHoliday(hol)}
                        className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHolidayToDelete(hol)}
                        className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-white rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: DATE-SPECIFIC QUOTA OVERRIDES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'overrides' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Date-Specific Doctor Quota Overrides</h4>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Increase or limit patient quotas for special dates (e.g. community health camps, reduced timings, or extended clinic hours).
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => handleOpenAddOverride()}
              className="flex items-center space-x-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Quota Override</span>
            </motion.button>
          </div>

          {quotaOverrides.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-200 text-center">
              <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto mb-2 stroke-[1.5]" />
              <h5 className="text-xs font-bold text-slate-700">No Date Overrides Active</h5>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Doctors follow their standard daily quota on all normal working days.
              </p>
              <button
                type="button"
                onClick={() => handleOpenAddOverride()}
                className="mt-3 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
              >
                Create First Override
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quotaOverrides.map((ovr) => {
                const doc = doctors.find((d) => d.id === ovr.doctorId);
                const defaultQuota = doc?.daily_quota || 30;
                const diff = ovr.customQuota - defaultQuota;

                return (
                  <div
                    key={ovr.id}
                    className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_25px_0_rgba(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">{ovr.doctorName}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {ovr.customQuota} Patients
                        </span>
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center text-xs font-medium text-slate-600 gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{ovr.date}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Standard Quota: <span className="font-semibold">{defaultQuota} pts</span>{' '}
                          <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            ({diff >= 0 ? `+${diff}` : diff} pts adjustment)
                          </span>
                        </div>
                        {ovr.reason && (
                          <div className="mt-2 p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600 border border-slate-200/60">
                            <span className="font-semibold text-slate-700">Reason: </span>
                            {ovr.reason}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditOverride(ovr)}
                        className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverrideToDelete(ovr)}
                        className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT HOLIDAY */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {isHolidayModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <CalendarCheck className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingHoliday ? 'Edit Clinic Holiday' : 'Add Clinic Holiday'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Mark chamber closure or reduced consultation hours
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveHoliday} className="p-5 space-y-3.5">
                {holidayFormError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{holidayFormError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Holiday Date *
                  </label>
                  <input
                    type="date"
                    value={holidayFormDate}
                    onChange={(e) => setHolidayFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Holiday / Occasion Name *
                  </label>
                  <input
                    type="text"
                    value={holidayFormName}
                    onChange={(e) => setHolidayFormName(e.target.value)}
                    placeholder="e.g. Christmas Day, Clinic Maintenance"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Holiday Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setHolidayFormType('full-day')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        holidayFormType === 'full-day'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Full-Day Closure
                    </button>
                    <button
                      type="button"
                      onClick={() => setHolidayFormType('partial-day')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        holidayFormType === 'partial-day'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Partial-Day
                    </button>
                  </div>
                </div>

                {holidayFormType === 'partial-day' && (
                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-amber-50/50 border border-amber-200/70 rounded-xl">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                        Start Closed Time
                      </label>
                      <input
                        type="time"
                        value={holidayFormStart}
                        onChange={(e) => setHolidayFormStart(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                        End Closed Time
                      </label>
                      <input
                        type="time"
                        value={holidayFormEnd}
                        onChange={(e) => setHolidayFormEnd(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Notes / Description
                  </label>
                  <textarea
                    rows={2}
                    value={holidayFormDesc}
                    onChange={(e) => setHolidayFormDesc(e.target.value)}
                    placeholder="Optional message displayed for staff & patients..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsHolidayModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer shadow-xs"
                  >
                    {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT QUOTA OVERRIDE */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {isOverrideModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingOverride ? 'Edit Quota Override' : 'Add Date Quota Override'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Override daily consultation limit for a specific date
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveOverride} className="p-5 space-y-3.5">
                {overrideFormError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{overrideFormError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select Doctor *
                  </label>
                  <select
                    value={overrideFormDoctorId}
                    onChange={(e) => {
                      const docId = e.target.value;
                      setOverrideFormDoctorId(docId);
                      const d = doctors.find((item) => item.id === docId);
                      if (d?.daily_quota) setOverrideFormQuota(d.daily_quota);
                    }}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.full_name} ({doc.specialization || 'General'} • Standard: {doc.daily_quota || 30} pts)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Override Date *
                  </label>
                  <input
                    type="date"
                    value={overrideFormDate}
                    onChange={(e) => setOverrideFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Custom Daily Quota (Patients: 1 – 200) *
                  </label>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setOverrideFormQuota((prev) => Math.max(1, prev - 5))}
                        className="px-3.5 py-2 hover:bg-slate-100 font-bold text-slate-600 transition cursor-pointer text-sm select-none"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={overrideFormQuota}
                        onChange={(e) =>
                          setOverrideFormQuota(
                            Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 1))
                          )
                        }
                        className="w-16 text-center text-xs font-bold py-2 focus:outline-none text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setOverrideFormQuota((prev) => Math.min(200, prev + 5))}
                        className="px-3.5 py-2 hover:bg-slate-100 font-bold text-slate-600 transition cursor-pointer text-sm select-none"
                      >
                        +
                      </button>
                    </div>

                    <span className="text-xs text-slate-500 font-semibold">
                      Adjusted to {overrideFormQuota} consultations
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reason / Clinical Note
                  </label>
                  <textarea
                    rows={2}
                    value={overrideFormReason}
                    onChange={(e) => setOverrideFormReason(e.target.value)}
                    placeholder="e.g. Free Diabetic Camp, Half Day Personal Leave, Evening Extra Hour"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsOverrideModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer shadow-xs"
                  >
                    {editingOverride ? 'Update Override' : 'Save Override'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --------------------------------------------------------------------- */}
      {/* DELETE CONFIRMATIONS */}
      {/* --------------------------------------------------------------------- */}
      <AnimatePresence>
        {holidayToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-100 w-full max-w-sm text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Remove Clinic Holiday?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <span className="font-bold text-slate-700">"{holidayToDelete.name}"</span> on {holidayToDelete.date}? Normal chamber shifts will resume.
              </p>
              <div className="mt-4 flex items-center justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => setHolidayToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteHoliday(holidayToDelete)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-xs"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {overrideToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-100 w-full max-w-sm text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Delete Quota Override?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Revert <span className="font-bold text-slate-700">{overrideToDelete.doctorName}</span> on {overrideToDelete.date} back to their standard quota?
              </p>
              <div className="mt-4 flex items-center justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => setOverrideToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteOverride(overrideToDelete)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-xs"
                >
                  Confirm Revert
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DoctorScheduleHolidayManager;

