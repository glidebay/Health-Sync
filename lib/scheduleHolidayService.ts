import { supabase } from './supabaseClient';
import { getTodayIST } from './utils';
import { DbDoctor } from '@/types/database';

export interface DoctorShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  slotDurationMins: number;
  bufferMins: number;
}

export interface DaySchedule {
  dayOfWeek: number;
  dayName: string;
  isEnabled: boolean;
  shifts: DoctorShift[];
}

export interface ClinicHoliday {
  id: string;
  date: string;
  name: string;
  description?: string;
  type: 'full-day' | 'partial-day';
  startTime?: string;
  endTime?: string;
  createdAt?: string;
}

export interface QuotaOverride {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string;
  customQuota: number;
  reason?: string;
  createdAt?: string;
}

const STORAGE_SHIFTS = 'healthsync_weekly_shifts';
const STORAGE_HOLIDAYS = 'healthsync_clinic_holidays';
const STORAGE_OVERRIDES = 'healthsync_quota_overrides';

export const SLOT_DURATIONS = [5, 10, 15, 20, 30, 45, 60];
export const BUFFER_TIMES = [0, 5, 10, 15];

export const DEFAULT_WEEKLY_SCHEDULE: DaySchedule[] = [
  {
    dayOfWeek: 1,
    dayName: 'Monday',
    isEnabled: true,
    shifts: [
      { id: 'mon-1', name: 'Morning OPD', startTime: '09:00', endTime: '13:00', slotDurationMins: 15, bufferMins: 5 },
      { id: 'mon-2', name: 'Evening Clinic', startTime: '16:30', endTime: '20:00', slotDurationMins: 15, bufferMins: 5 },
    ],
  },
  {
    dayOfWeek: 2,
    dayName: 'Tuesday',
    isEnabled: true,
    shifts: [
      { id: 'tue-1', name: 'Morning OPD', startTime: '09:00', endTime: '13:00', slotDurationMins: 15, bufferMins: 5 },
      { id: 'tue-2', name: 'Evening Clinic', startTime: '16:30', endTime: '20:00', slotDurationMins: 15, bufferMins: 5 },
    ],
  },
  {
    dayOfWeek: 3,
    dayName: 'Wednesday',
    isEnabled: true,
    shifts: [
      { id: 'wed-1', name: 'Morning OPD', startTime: '09:00', endTime: '13:00', slotDurationMins: 15, bufferMins: 5 },
      { id: 'wed-2', name: 'Evening Clinic', startTime: '16:30', endTime: '20:00', slotDurationMins: 15, bufferMins: 5 },
    ],
  },
  {
    dayOfWeek: 4,
    dayName: 'Thursday',
    isEnabled: true,
    shifts: [
      { id: 'thu-1', name: 'Morning OPD', startTime: '09:00', endTime: '13:00', slotDurationMins: 15, bufferMins: 5 },
      { id: 'thu-2', name: 'Evening Clinic', startTime: '16:30', endTime: '20:00', slotDurationMins: 15, bufferMins: 5 },
    ],
  },
  {
    dayOfWeek: 5,
    dayName: 'Friday',
    isEnabled: true,
    shifts: [
      { id: 'fri-1', name: 'Morning OPD', startTime: '09:00', endTime: '13:00', slotDurationMins: 15, bufferMins: 5 },
      { id: 'fri-2', name: 'Evening Clinic', startTime: '16:30', endTime: '20:00', slotDurationMins: 15, bufferMins: 5 },
    ],
  },
  {
    dayOfWeek: 6,
    dayName: 'Saturday',
    isEnabled: true,
    shifts: [
      { id: 'sat-1', name: 'Morning Session', startTime: '09:00', endTime: '14:00', slotDurationMins: 15, bufferMins: 5 },
    ],
  },
  {
    dayOfWeek: 7,
    dayName: 'Sunday',
    isEnabled: false,
    shifts: [
      { id: 'sun-1', name: 'Emergency Triage', startTime: '10:00', endTime: '13:00', slotDurationMins: 20, bufferMins: 5 },
    ],
  },
];

export const DEFAULT_HOLIDAYS: ClinicHoliday[] = [
  {
    id: 'hol-1',
    date: '2026-11-26',
    name: 'Thanksgiving & Annual Health Audit',
    description: 'Chamber closed for digital inventory audit & sanitization.',
    type: 'full-day',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hol-2',
    date: '2026-12-25',
    name: 'Christmas Day',
    description: 'Official clinical public holiday.',
    type: 'full-day',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hol-3',
    date: '2026-12-31',
    name: 'New Year’s Eve',
    description: 'Half-day clinic; evening emergency buffer active.',
    type: 'partial-day',
    startTime: '14:00',
    endTime: '20:00',
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_OVERRIDES: QuotaOverride[] = [
  {
    id: 'ovr-1',
    doctorId: 'doc-sunny-default',
    doctorName: 'Dr. Sunny',
    date: '2026-11-14',
    customQuota: 50,
    reason: 'World Diabetes Day Community Screening Camp',
    createdAt: new Date().toISOString(),
  },
];

export function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

export function calculateShiftSlots(shift: DoctorShift): number {
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);
  if (end <= start) return 0;
  const cycle = (shift.slotDurationMins || 15) + (shift.bufferMins || 0);
  if (cycle <= 0) return 0;
  return Math.floor((end - start) / cycle);
}

export function checkShiftOverlap(
  shift: { startTime: string; endTime: string },
  otherShifts: { startTime: string; endTime: string }[],
  excludeId?: string
): boolean {
  const s1 = timeToMinutes(shift.startTime);
  const e1 = timeToMinutes(shift.endTime);
  if (e1 <= s1) return true;

  for (const other of otherShifts) {
    if ((other as any).id === excludeId) continue;
    const s2 = timeToMinutes(other.startTime);
    const e2 = timeToMinutes(other.endTime);
    if (s1 < e2 && e1 > s2) {
      return true;
    }
  }
  return false;
}


export async function fetchWeeklyShifts(): Promise<DaySchedule[]> {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_SHIFTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 7) return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading shifts from localStorage:', e);
  }

  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'clinic_weekly_shifts')
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed) && parsed.length === 7) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Exception loading shifts from Supabase:', err);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(DEFAULT_WEEKLY_SCHEDULE));
  }
  return DEFAULT_WEEKLY_SCHEDULE;
}

export async function saveWeeklyShifts(schedule: DaySchedule[]): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(schedule));
    }

    await supabase.from('app_config').upsert(
      {
        key: 'clinic_weekly_shifts',
        value: JSON.stringify(schedule),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    return { success: true };
  } catch (err: any) {
    console.warn('saveWeeklyShifts error:', err);
    return { success: false, error: err.message || 'Failed to save shifts' };
  }
}

export async function fetchClinicHolidays(): Promise<ClinicHoliday[]> {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_HOLIDAYS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading holidays from localStorage:', e);
  }

  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'clinic_holidays')
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_HOLIDAYS, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Exception loading holidays from Supabase:', err);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_HOLIDAYS, JSON.stringify(DEFAULT_HOLIDAYS));
  }
  return DEFAULT_HOLIDAYS;
}

export async function saveClinicHolidays(holidays: ClinicHoliday[]): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_HOLIDAYS, JSON.stringify(holidays));
    }

    await supabase.from('app_config').upsert(
      {
        key: 'clinic_holidays',
        value: JSON.stringify(holidays),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    return { success: true };
  } catch (err: any) {
    console.warn('saveClinicHolidays error:', err);
    return { success: false, error: err.message || 'Failed to save holidays' };
  }
}

export async function fetchQuotaOverrides(): Promise<QuotaOverride[]> {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_OVERRIDES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading overrides from localStorage:', e);
  }

  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'clinic_quota_overrides')
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Exception loading overrides from Supabase:', err);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(DEFAULT_OVERRIDES));
  }
  return DEFAULT_OVERRIDES;
}

export async function saveQuotaOverrides(overrides: QuotaOverride[]): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(overrides));
    }

    await supabase.from('app_config').upsert(
      {
        key: 'clinic_quota_overrides',
        value: JSON.stringify(overrides),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    return { success: true };
  } catch (err: any) {
    console.warn('saveQuotaOverrides error:', err);
    return { success: false, error: err.message || 'Failed to save overrides' };
  }
}


export function isHoliday(dateStr: string, holidays: ClinicHoliday[]): ClinicHoliday | undefined {
  if (!dateStr || !holidays) return undefined;
  return holidays.find((h) => h.date === dateStr);
}

export function getDoctorQuotaOverride(
  doctorId: string,
  dateStr: string,
  overrides: QuotaOverride[]
): QuotaOverride | undefined {
  if (!dateStr || !overrides) return undefined;
  return overrides.find((o) => o.doctorId === doctorId && o.date === dateStr);
}

export function getDayScheduleForDate(dateStr: string, schedule: DaySchedule[]): DaySchedule | undefined {
  if (!dateStr || !schedule) return undefined;
  const dateObj = new Date(`${dateStr}T12:00:00Z`);
  const jsDay = dateObj.getUTCDay();
  const dayNum = jsDay === 0 ? 7 : jsDay;
  return schedule.find((d) => d.dayOfWeek === dayNum);
}

