'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartPulse,
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  User,
  Check,
  PlusCircle,
  CalendarPlus,
  ArrowLeft,
  Ticket,
  Printer,
  Phone,
  MapPin,
  ChevronDown,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
} from 'lucide-react';
import { Patient, ConfirmedToken } from '@/types';
import { DbDoctor } from '@/types/database';
import { AVAILABLE_SLOTS, QUICK_SYMPTOMS } from '@/lib/constants';
import EcgActionLoader from '@/components/loading/EcgActionLoader';
import { formatPatientToken } from '@/lib/utils';
import { validateMobileNumber } from '@/lib/phoneValidation';
import {
  getDoctorSlotsForDate,
  generateDailySlots,
  SlotItem,
  subscribeToClinicUpdates,
} from '@/lib/supabaseService';
import { useClinic } from '@/context/ClinicContext';

interface DoctorSearchComboboxProps {
  doctors: DbDoctor[];
  selectedDoctorId: string;
  onSelectDoctorId: (id: string) => void;
}

function DoctorSearchCombobox({
  doctors,
  selectedDoctorId,
  onSelectDoctorId,
}: DoctorSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedDoctor = useMemo(() => {
    return doctors.find((d) => d.id === selectedDoctorId) || doctors[0] || null;
  }, [doctors, selectedDoctorId]);

  const [query, setQuery] = useState(() =>
    selectedDoctor
      ? `${selectedDoctor.full_name} (${selectedDoctor.specialization || 'General Medicine'})`
      : ''
  );

  const prevDocIdRef = useRef(selectedDoctorId);
  useEffect(() => {
    if (prevDocIdRef.current !== selectedDoctorId) {
      prevDocIdRef.current = selectedDoctorId;
      if (selectedDoctor) {
        setQuery(`${selectedDoctor.full_name} (${selectedDoctor.specialization || 'General Medicine'})`);
      }
    }
  }, [selectedDoctorId, selectedDoctor]);

  const filteredDoctors = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isExact =
      selectedDoctor &&
      query === `${selectedDoctor.full_name} (${selectedDoctor.specialization || 'General Medicine'})`;
    if (!q || isExact) return doctors;
    return doctors.filter(
      (d) =>
        d.full_name.toLowerCase().includes(q) ||
        (d.specialization && d.specialization.toLowerCase().includes(q))
    );
  }, [doctors, query, selectedDoctor]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedDoctor) {
          setQuery(`${selectedDoctor.full_name} (${selectedDoctor.specialization || 'General Medicine'})`);
        } else {
          setQuery('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedDoctor]);

  const handleSelect = (doc: DbDoctor) => {
    onSelectDoctorId(doc.id);
    setQuery(`${doc.full_name} (${doc.specialization || 'General Medicine'})`);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 >= filteredDoctors.length ? 0 : prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 < 0 ? filteredDoctors.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredDoctors.length) {
        handleSelect(filteredDoctors[highlightedIndex]);
      } else if (filteredDoctors.length === 1) {
        handleSelect(filteredDoctors[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      if (selectedDoctor) {
        setQuery(`${selectedDoctor.full_name} (${selectedDoctor.specialization || 'General Medicine'})`);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full flex items-center gap-2.5 px-3 sm:px-3.5 h-11 sm:h-12 bg-[#F8F9FB] border rounded-xl text-xs sm:text-sm cursor-text transition-all duration-150 ${isOpen
          ? 'border-[#2563EB] ring-2 ring-blue-500/10 bg-white shadow-xs'
          : 'border-[#ECEEF2] hover:border-gray-300'
          }`}
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] flex-shrink-0">
          <Stethoscope className="w-3.5 h-3.5 stroke-[2.2]" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            setIsOpen(true);
            inputRef.current?.select();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search physician by name or specialty..."
          className="w-full bg-transparent outline-none text-[#16191E] placeholder:text-[#8A909D] font-semibold text-xs sm:text-sm min-w-0"
        />

        {query ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              setIsOpen(true);
              setHighlightedIndex(-1);
              inputRef.current?.focus();
            }}
            title="Clear"
            className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-gray-700 transition flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
            if (!isOpen) inputRef.current?.focus();
          }}
          className="p-1 text-[#8A909D] hover:text-[#16191E] transition flex-shrink-0"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#2563EB]' : ''}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-[#ECEEF2] rounded-xl shadow-xl overflow-hidden"
          >
            <ul ref={listRef} className="max-h-56 sm:max-h-60 overflow-y-auto divide-y divide-[#F1F3F6] p-1">
              {filteredDoctors.length === 0 ? (
                <li className="px-4 py-5 text-center text-xs text-[#8A909D]">
                  <p className="font-semibold text-gray-600">No matching doctors found</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Try searching with another name or specialty</p>
                </li>
              ) : (
                filteredDoctors.map((doc, idx) => {
                  const isSelected = doc.id === selectedDoctorId;
                  const isHighlighted = highlightedIndex === idx;

                  return (
                    <li
                      key={doc.id}
                      onClick={() => handleSelect(doc)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-lg flex items-center justify-between gap-2.5 text-xs cursor-pointer transition-colors ${isSelected
                        ? 'bg-blue-50 text-[#2563EB]'
                        : isHighlighted
                          ? 'bg-[#F4F5F7]'
                          : 'hover:bg-[#F8F9FB]'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${isSelected ? 'bg-[#2563EB] text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                        >
                          {doc.full_name.charAt(doc.full_name.startsWith('Dr.') ? 4 : 0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                            <span className={`font-bold truncate text-xs ${isSelected ? 'text-[#2563EB]' : 'text-[#16191E]'}`}>
                              {doc.full_name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-[#2563EB] border border-blue-100 font-semibold w-fit">
                              {doc.specialization || 'General Medicine'}
                            </span>
                          </div>
                          {doc.reg_no && (
                            <span className="text-[10px] text-[#8A909D] block mt-0.5">Reg: {doc.reg_no}</span>
                          )}
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-[#2563EB] flex-shrink-0" />}
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface DateOption {
  dateString: string;
  dayOfWeek: string;
  dayNumber: string;
  monthName: string;
  isToday: boolean;
  isTomorrow: boolean;
  isWeekend: boolean;
  formattedLabel: string;
  shortLabel: string;
}

export function formatYMDToDisplay(ymd?: string): string {
  if (!ymd) return 'Today';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mIndex = parseInt(parts[1], 10) - 1;
  const monthStr = monthNames[mIndex] || parts[1];
  return `${parseInt(parts[2], 10)} ${monthStr} ${parts[0]}`;
}

export function getBookingDates(selectedDateStr?: string, baseDate?: Date, maxDays: number = 14): DateOption[] {
  const dates: DateOption[] = [];
  const today = baseDate ? new Date(baseDate) : new Date();
  const safeDays = Math.max(1, Math.min(60, Number(maxDays) || 14));

  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const monthNames = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];

  for (let i = 0; i < safeDays; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dateString = formatYMD(d);
    const dayIndex = d.getDay();
    const dayOfWeek = dayNames[dayIndex];
    const dayNumber = String(d.getDate()).padStart(2, '0');
    const monthName = monthNames[d.getMonth()];
    const isToday = i === 0;
    const isTomorrow = i === 1;
    const isWeekend = dayIndex === 0 || dayIndex === 6;

    const formattedLabel = `${dayOfWeek}, ${d.getDate()} ${monthName} ${d.getFullYear()}`;

    const shortLabel = isToday
      ? `Today, ${d.getDate()} ${monthName}`
      : isTomorrow
        ? `Tomorrow, ${d.getDate()} ${monthName}`
        : `${dayOfWeek}, ${d.getDate()} ${monthName}`;

    dates.push({
      dateString,
      dayOfWeek,
      dayNumber,
      monthName,
      isToday,
      isTomorrow,
      isWeekend,
      formattedLabel,
      shortLabel,
    });
  }

  if (selectedDateStr && !dates.some((d) => d.dateString === selectedDateStr)) {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    if (y && m && d) {
      const customD = new Date(y, m - 1, d);
      const dayIndex = customD.getDay();
      const monthName = monthNames[customD.getMonth()] || '';
      dates.push({
        dateString: selectedDateStr,
        dayOfWeek: dayNames[dayIndex] || 'DAY',
        dayNumber: String(customD.getDate()).padStart(2, '0'),
        monthName,
        isToday: false,
        isTomorrow: false,
        isWeekend: dayIndex === 0 || dayIndex === 6,
        formattedLabel: `${dayNames[dayIndex]}, ${customD.getDate()} ${monthName} ${customD.getFullYear()}`,
        shortLabel: `${dayNames[dayIndex]}, ${customD.getDate()} ${monthName}`,
      });
    }
  }

  return dates;
}

interface SlotBookingViewProps {
  queue: Patient[];
  waitingPatientsCount?: number;
  doctorProfile?: { name: string; title: string };
  availableDoctors: DbDoctor[];
  bookDate?: string;
  setBookDate?: (v: string) => void;
  bookName: string;
  setBookName: (v: string) => void;
  bookPhone: string;
  setBookPhone: (v: string) => void;
  bookAge: string;
  setBookAge: (v: string) => void;
  bookGender: 'Male' | 'Female' | 'Other';
  setBookGender: (v: 'Male' | 'Female' | 'Other') => void;
  bookPriority: 'Normal' | 'Urgent';
  setBookPriority: (v: 'Normal' | 'Urgent') => void;
  bookDoctorId: string;
  setBookDoctorId: (v: string) => void;
  bookSlotTime: string;
  setBookSlotTime: (v: string) => void;
  bookReason: string;
  setBookReason: (v: string) => void;
  isBookingSubmitting: boolean;
  confirmedToken: ConfirmedToken | null;
  setConfirmedToken: (v: ConfirmedToken | null) => void;
  handleBookSlotSubmit: (e: React.FormEvent) => void;
  onBackToGateway?: () => void;
  onGoToConsulting?: () => void;
  isStandalone?: boolean;
}

export function SlotBookingView({
  queue,
  availableDoctors,
  bookDate,
  setBookDate,
  bookName,
  setBookName,
  bookPhone,
  setBookPhone,
  bookAge,
  setBookAge,
  bookGender,
  setBookGender,
  bookPriority,
  setBookPriority,
  bookDoctorId,
  setBookDoctorId,
  bookSlotTime,
  setBookSlotTime,
  bookReason,
  setBookReason,
  isBookingSubmitting,
  confirmedToken,
  setConfirmedToken,
  handleBookSlotSubmit,
  onBackToGateway,
  isStandalone = false,
}: SlotBookingViewProps) {
  const { config } = useClinic();
  const maxAdvanceBookingDays = config?.max_advance_booking_days
    ? Number(config.max_advance_booking_days)
    : 14;

  const maxAllowedDate = useMemo(() => {
    const now = new Date();
    const maxD = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Math.max(1, maxAdvanceBookingDays) - 1);
    const y = maxD.getFullYear();
    const m = String(maxD.getMonth() + 1).padStart(2, '0');
    const d = String(maxD.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [maxAdvanceBookingDays]);

  const [pickerMode, setPickerMode] = useState<'grid' | 'standard'>('grid');
  const [standardDate, setStandardDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [standardTime, setStandardTime] = useState('09:30');

  useEffect(() => {
    if (config?.use_standard_date_picker !== undefined) {
      setPickerMode(config.use_standard_date_picker ? 'standard' : 'grid');
    }
  }, [config?.use_standard_date_picker]);

  const convertTo12Hour = (time24: string) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let hour = parseInt(hStr, 10);
    const minute = mStr || '00';
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;
    return `${String(hour).padStart(2, '0')}:${minute} ${meridiem}`;
  };

  const [selectedPeriod, setSelectedPeriod] = useState<'All' | 'Morning' | 'Afternoon' | 'Evening'>('All');
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const ageInputRef = useRef<HTMLInputElement>(null);

  const [internalDate, setInternalDate] = useState<string>('');
  const [todayMinDate, setTodayMinDate] = useState<string>('');
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);

  const activeDate = bookDate || internalDate;

  useEffect(() => {
    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setTodayMinDate(ymd);

    const targetDate = bookDate || internalDate || ymd;
    if (!bookDate && !internalDate) {
      setInternalDate(ymd);
    }
    setDateOptions(getBookingDates(targetDate, now, maxAdvanceBookingDays));
  }, [bookDate, internalDate, maxAdvanceBookingDays]);

  const handleDateChange = (dateStr: string) => {
    if (setBookDate) {
      setBookDate(dateStr);
    } else {
      setInternalDate(dateStr);
    }
    const now = new Date();
    setDateOptions(getBookingDates(dateStr, now, maxAdvanceBookingDays));
  };

  const currentDateOption = useMemo(
    () => (activeDate ? dateOptions.find((d) => d.dateString === activeDate) : null) || dateOptions[0] || null,
    [dateOptions, activeDate]
  );

  const scrollDates = (direction: 'left' | 'right') => {
    if (dateScrollRef.current) {
      const offset = direction === 'left' ? -240 : 240;
      dateScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsSummary, setSlotsSummary] = useState<{
    availableCount: number;
    bookedCount: number;
    dailyQuota: number;
  }>({ availableCount: 0, bookedCount: 0, dailyQuota: 30 });

  const effectiveDoctorId = bookDoctorId || (availableDoctors[0]?.id ?? '');

  const loadDoctorSlots = useCallback(async () => {
    if (!effectiveDoctorId || !activeDate) return;
    setIsLoadingSlots(true);
    try {
      const res = await getDoctorSlotsForDate(effectiveDoctorId, activeDate);
      setSlots(res.slots);
      setSlotsSummary({
        availableCount: res.availableCount,
        bookedCount: res.bookedCount,
        dailyQuota: res.dailyQuota,
      });

      const currentSelected = res.slots.find((s) => s.time === bookSlotTime);
      if (!currentSelected || currentSelected.isBooked || currentSelected.isPast || !currentSelected.isAvailable) {
        const firstAvailable = res.slots.find((s) => (s.isAvailable ?? true) && !s.isBooked && !s.isPast);
        if (firstAvailable) {
          setBookSlotTime(firstAvailable.time);
        }
      }
    } catch (err) {
      console.warn('Error fetching slots for doctor/date:', err);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [effectiveDoctorId, activeDate, bookSlotTime, setBookSlotTime]);

  useEffect(() => {
    loadDoctorSlots();
  }, [loadDoctorSlots]);

  useEffect(() => {
    const unsub = subscribeToClinicUpdates(() => {
      loadDoctorSlots();
    });
    return () => unsub();
  }, [loadDoctorSlots]);

  useEffect(() => {
    if (confirmedToken) {
      loadDoctorSlots();
    }
  }, [confirmedToken, loadDoctorSlots]);

  const currentSlots = useMemo(() => {
    if (slots.length > 0) {
      if (activeDate && activeDate === todayMinDate) {
        const upcoming = slots.filter((slot) => !slot.isPast);
        return upcoming.length > 0 ? upcoming : slots;
      }
      return slots;
    }
    const fallback = generateDailySlots(slotsSummary.dailyQuota || 10, 15, activeDate);
    if (activeDate && activeDate === todayMinDate) {
      const upcomingFallback = fallback.filter((slot) => !slot.isPast);
      return upcomingFallback.length > 0 ? upcomingFallback : fallback;
    }
    return fallback;
  }, [slots, slotsSummary.dailyQuota, activeDate, todayMinDate]);

  const filteredSlots = useMemo(() => {
    if (selectedPeriod === 'All') return currentSlots;
    return currentSlots.filter((slot) => slot.period === selectedPeriod);
  }, [currentSlots, selectedPeriod]);

  const periodCounts = useMemo(() => {
    return {
      All: currentSlots.length,
      Morning: currentSlots.filter((s) => s.period === 'Morning').length,
      Afternoon: currentSlots.filter((s) => s.period === 'Afternoon').length,
      Evening: currentSlots.filter((s) => s.period === 'Evening').length,
    };
  }, [currentSlots]);

  // If the active filter has 0 slots (e.g. Morning passed for today), auto-switch to All
  useEffect(() => {
    if (selectedPeriod !== 'All' && periodCounts[selectedPeriod] === 0) {
      setSelectedPeriod('All');
    }
  }, [selectedPeriod, periodCounts]);

  const handleBookingFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (phoneInputRef.current) {
      if (!bookPhone.trim()) {
        phoneInputRef.current.setCustomValidity('Please fill out this field.');
        phoneInputRef.current.reportValidity();
        return;
      }
      const res = validateMobileNumber(bookPhone);
      if (!res.isValid) {
        phoneInputRef.current.setCustomValidity(res.errorMessage || 'Please enter a valid 10-digit mobile number.');
        phoneInputRef.current.reportValidity();
        return;
      }
      phoneInputRef.current.setCustomValidity('');
    }

    if (ageInputRef.current) {
      if (!bookAge.trim()) {
        ageInputRef.current.setCustomValidity('Please fill out this field.');
        ageInputRef.current.reportValidity();
        return;
      }
      const parsedAge = parseInt(bookAge, 10);
      if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        ageInputRef.current.setCustomValidity('Please enter a valid age between 1 and 120.');
        ageInputRef.current.reportValidity();
        return;
      }
      ageInputRef.current.setCustomValidity('');
    }

    handleBookSlotSubmit(e);
  };

  const content = (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {confirmedToken ? (
          <motion.div
            key="confirmed-card"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-emerald-200 shadow-md text-center max-w-xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.12, type: 'spring', damping: 12, stiffness: 240 }}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3.5 text-emerald-600 shadow-sm"
            >
              <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.2]" />
            </motion.div>
            <div className="inline-flex items-center px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] sm:text-xs font-bold tracking-wide uppercase mb-1.5">
              Slot Confirmed & Token Generated
            </div>
            <h3 className="text-lg sm:text-2xl font-bold text-[#16191E] mb-1">Appointment Successfully Booked</h3>
            <p className="text-xs sm:text-sm text-[#8A909D] mb-5">Present this token at reception or clinical waiting lounge</p>

            <div className="bg-[#F8F9FB] rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] max-w-md mx-auto mb-5 text-left">
              {/* Clinic Header on Slip */}
              <div className="flex items-center gap-2.5 pb-3.5 mb-3.5 border-b border-[#ECEEF2]">
                {config?.logo_url ? (
                  <div className="w-8 h-8 rounded-lg border border-[#ECEEF2] bg-white overflow-hidden flex items-center justify-center p-0.5 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={config.logo_url} alt={config.clinic_name || 'Clinic Logo'} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] flex-shrink-0">
                    <HeartPulse className="w-4 h-4 stroke-[2.2]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[#16191E] truncate">
                    {config?.clinic_name || 'HealthSync Clinic'}
                  </h4>
                  <p className="text-[10px] text-[#8A909D] truncate">
                    {[config?.clinic_address, config?.clinic_phone].filter(Boolean).join(' • ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pb-3.5 border-b border-[#ECEEF2]">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#8A909D] uppercase tracking-wider block">OPD Token Number</span>
                  <span className="text-2xl sm:text-3xl font-black text-[#2563EB]">
                    {formatPatientToken({ tokenNumber: confirmedToken.tokenNumber })}
                  </span>
                </div>
                <span
                  className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold ${confirmedToken.priority === 'Urgent'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-blue-50 text-[#2563EB] border border-blue-100'
                    }`}
                >
                  {confirmedToken.priority} Visit
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-3.5 text-xs sm:text-sm">
                <div>
                  <span className="text-[#8A909D] font-medium block text-[11px] sm:text-xs">Patient Name</span>
                  <span className="font-bold text-[#16191E]">{confirmedToken.name}</span>
                </div>
                <div>
                  <span className="text-[#8A909D] font-medium block text-[11px] sm:text-xs">Consultation Date</span>
                  <span className="font-bold text-[#16191E]">
                    {confirmedToken.date
                      ? formatYMDToDisplay(confirmedToken.date)
                      : currentDateOption?.shortLabel || 'Today'}
                  </span>
                </div>
                <div>
                  <span className="text-[#8A909D] font-medium block text-[11px] sm:text-xs">Scheduled Time</span>
                  <span className="font-bold text-[#16191E]">{confirmedToken.time}</span>
                </div>
                <div>
                  <span className="text-[#8A909D] font-medium block text-[11px] sm:text-xs">Consulting Doctor</span>
                  <span className="font-bold text-[#16191E]">{confirmedToken.doctorName}</span>
                </div>
                <div>
                  <span className="text-[#8A909D] font-medium block text-[11px] sm:text-xs">Phone / Contact</span>
                  <span className="font-bold text-[#16191E]">{confirmedToken.phone || 'Online Booking'}</span>
                </div>
                <div>
                  <span className="text-[#8A909D] font-medium block text-[11px] sm:text-xs">Booking Channel</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-0.5">
                    {confirmedToken.channel || 'Online'}
                  </span>
                </div>
                <div>
                  <span className="text-[#8A909D] font-medium block text-[11px] sm:text-xs">Visit Priority</span>
                  <span className="font-bold text-[#16191E]">{confirmedToken.priority} Visit</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => window.print()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white border border-[#ECEEF2] hover:bg-gray-50 text-xs font-bold text-[#16191E] flex items-center justify-center space-x-2 transition cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4 text-gray-600" />
                <span>Print Token Slip</span>
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setConfirmedToken(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Book Another Slot</span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="booking-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleBookingFormSubmit}
            className="bg-white rounded-2xl sm:rounded-3xl border border-[#ECEEF2] p-4 sm:p-7 lg:p-8 shadow-sm space-y-4 sm:space-y-6 relative overflow-hidden"
          >
            <EcgActionLoader isLoading={isBookingSubmitting} text="Confirming consultation booking..." />
            <div className="text-center pb-4 sm:pb-5 border-b border-[#ECEEF2]">

              <h2 className="text-lg sm:text-2xl font-bold text-[#16191E] tracking-tight">
                Book a Consultation Slot
              </h2>
              <p className="text-xs sm:text-sm text-[#8A909D] mt-1 max-w-md mx-auto">
                Select your preferred date, available time slot & register patient details
              </p>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm font-bold text-[#16191E] flex items-center gap-1.5 sm:gap-2">
                  <Calendar className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                  <span>Select Date</span>

                </label>

                <div className="flex items-center space-x-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => scrollDates('left')}
                    title="Previous dates"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-[#ECEEF2] hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-[#16191E] transition cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollDates('right')}
                    title="Next dates"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-[#ECEEF2] hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-[#16191E] transition cursor-pointer shadow-2xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <input
                      ref={dateInputRef}
                      type="date"
                      min={todayMinDate}
                      max={maxAllowedDate}
                      value={activeDate}
                      onChange={(e) => {
                        if (e.target.value) handleDateChange(e.target.value);
                      }}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          dateInputRef.current?.showPicker();
                        } catch {
                          dateInputRef.current?.focus();
                        }
                      }}
                      className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg bg-white border border-[#ECEEF2] hover:border-[#2563EB]/40 hover:bg-blue-50/50 flex items-center space-x-1 sm:space-x-1.5 text-[11px] sm:text-xs font-bold text-[#5E6470] hover:text-[#2563EB] transition cursor-pointer shadow-2xs"
                      title="Choose specific date from calendar"
                    >
                      <CalendarDays className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span className="hidden xs:inline">Calendar</span>
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={dateScrollRef}
                className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 bg-[#F8F9FB] rounded-xl sm:rounded-2xl border border-[#ECEEF2] overflow-x-auto scroll-smooth scrollbar-none min-h-[82px]"
              >
                {dateOptions.length === 0 ? (
                  <div className="flex items-center gap-2 py-1 w-full overflow-hidden">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div
                        key={i}
                        className="min-w-[64px] sm:min-w-[74px] h-[74px] sm:h-[78px] rounded-xl bg-gray-100/70 border border-[#ECEEF2] animate-pulse flex-shrink-0"
                      />
                    ))}
                  </div>
                ) : (
                  dateOptions.map((item) => {
                    const isSelected = activeDate === item.dateString;
                    return (
                      <motion.button
                        key={item.dateString}
                        type="button"
                        whileHover={{ y: -2, scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        onClick={() => handleDateChange(item.dateString)}
                        className={`relative min-w-[64px] sm:min-w-[74px] flex-1 py-2 sm:py-2.5 px-1.5 rounded-xl text-center cursor-pointer flex flex-col items-center justify-between transition-all select-none border flex-shrink-0 ${isSelected
                          ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-md shadow-blue-500/25 ring-2 ring-[#2563EB] ring-offset-1'
                          : 'bg-white hover:bg-blue-50/50 text-[#16191E] border-[#ECEEF2] hover:border-blue-200 shadow-2xs'
                          }`}
                      >
                        <div className="flex items-center justify-center h-4 w-full">
                          {item.isToday ? (
                            <span
                              className={`text-[8px] sm:text-[9px] font-black tracking-wider uppercase px-1.5 py-0.2 rounded-full ${isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-blue-50 text-[#2563EB] border border-blue-100'
                                }`}
                            >
                              TODAY
                            </span>
                          ) : item.isTomorrow ? (
                            <span
                              className={`text-[8px] sm:text-[9px] font-black tracking-wider uppercase px-1.5 py-0.2 rounded-full ${isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                }`}
                            >
                              TOM
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${isSelected
                                ? 'text-blue-100'
                                : item.isWeekend
                                  ? 'text-amber-600 font-extrabold'
                                  : 'text-[#8A909D]'
                                }`}
                            >
                              {item.dayOfWeek}
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-lg sm:text-2xl font-black leading-none my-1 tracking-tight ${isSelected ? 'text-white' : 'text-[#16191E]'
                            }`}
                        >
                          {item.dayNumber}
                        </span>

                        <span
                          className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wide ${isSelected ? 'text-blue-100' : 'text-[#8A909D]'
                            }`}
                        >
                          {item.monthName}
                        </span>
                      </motion.button>
                    );
                  })
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] sm:text-xs text-[#8A909D] px-1 gap-1">

                <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                  Book up to {maxAdvanceBookingDays} days in advance
                </span>
              </div>
            </div>

            <div className="space-y-2.5 sm:space-y-3 pt-1 border-t border-[#ECEEF2]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs sm:text-sm font-bold text-[#16191E] flex items-center gap-1.5 sm:gap-2">
                    <Clock className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                    <span>Select Time Slot</span>
                  </label>

                  {isLoadingSlots && (
                    <span className="text-[10px] text-blue-500 animate-pulse font-medium">Checking live slots...</span>
                  )}
                </div>

                <div className="flex items-center space-x-1 bg-[#F8F9FB] p-1 rounded-xl border border-[#ECEEF2] overflow-x-auto max-w-full scrollbar-none self-start sm:self-auto">
                  {(['All', 'Morning', 'Afternoon', 'Evening'] as const)
                    .filter((period) => period === 'All' || periodCounts[period] > 0)
                    .map((period) => {
                      const count = periodCounts[period];
                      const isActive = selectedPeriod === period;
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setSelectedPeriod(period)}
                          className={`relative text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 sm:gap-1.5 z-10 whitespace-nowrap flex-shrink-0 ${isActive ? 'text-[#2563EB]' : 'text-[#8A909D] hover:text-[#16191E]'
                            }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activePeriodPill"
                              className="absolute inset-0 bg-white rounded-lg shadow-2xs -z-10"
                              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            />
                          )}
                          <span>{period}</span>
                          <span
                            className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-blue-50 text-[#2563EB]' : 'bg-gray-200/60 text-gray-500'
                              }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {slotsSummary.availableCount === 0 && !isLoadingSlots && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Daily Quota Reached:</strong> All {slotsSummary.dailyQuota} consultation slots are booked for this date. Emergency patients can switch to <strong>Urgent Priority</strong> below to bypass quota limits.
                  </span>
                </div>
              )}

              <div className="relative grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-2.5 p-2.5 sm:p-3.5 bg-[#F8F9FB] rounded-xl sm:rounded-2xl border border-[#ECEEF2] min-h-[90px]">
                <EcgActionLoader isLoading={isLoadingSlots} size="sm" text="Checking live slots..." />
                {filteredSlots.map((slot) => {
                  const isBooked = Boolean(slot.isBooked);
                  const isPast = Boolean(slot.isPast);
                  const isSelected = bookSlotTime === slot.time && !isBooked && !isPast;

                  if (isPast) {
                    return null;
                  }

                  if (isBooked) {
                    return (
                      <div
                        key={slot.time}
                        title={`Slot ${slot.time} is already booked`}
                        className="relative py-2 sm:py-2.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all text-center select-none bg-[#ECEEF2] text-[#8C93A0] border border-[#DCE0E6] cursor-not-allowed flex flex-col items-center justify-center gap-0.5 opacity-75 shadow-none"
                      >
                        <span className="tracking-tight text-[11px] sm:text-xs md:text-sm font-medium">
                          {slot.time}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <motion.button
                      key={slot.time}
                      type="button"
                      whileHover={{ y: -2, scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      onClick={() => setBookSlotTime(slot.time)}
                      className={`relative py-2 sm:py-2.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-0.5 overflow-hidden ${isSelected
                        ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/20 ring-2 ring-[#2563EB] ring-offset-1'
                        : 'bg-white hover:bg-blue-50/60 text-[#16191E] border border-[#ECEEF2] hover:border-blue-200'
                        }`}
                    >
                      <span className="tracking-tight text-[11px] sm:text-xs md:text-sm">{slot.time}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {availableDoctors.length > 0 && (
              <div className="space-y-1.5 sm:space-y-2 pt-1 border-t border-[#ECEEF2]">
                <label className="text-xs sm:text-sm font-bold text-[#16191E] flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-[#2563EB]" />
                  <span>Consulting Physician</span>
                </label>
                <DoctorSearchCombobox
                  doctors={availableDoctors}
                  selectedDoctorId={bookDoctorId}
                  onSelectDoctorId={setBookDoctorId}
                />
              </div>
            )}

            <div className="space-y-3 sm:space-y-4 pt-1 border-t border-[#ECEEF2]">
              <label className="text-xs sm:text-sm font-bold text-[#16191E] flex items-center gap-2">
                <User className="w-4 h-4 text-[#2563EB]" />
                <span>Patient Information</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <span className="text-xs font-semibold text-[#8A909D] block mb-1">Patient Full Name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={bookName}
                    onChange={(e) => setBookName(e.target.value)}
                    className="w-full h-11 sm:h-12 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm text-[#16191E] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all duration-150"
                  />
                </div>

                <div>
                  <span className="text-xs font-semibold text-[#8A909D] block mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </span>
                  <div className="relative">
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      required
                      placeholder="e.g. 98460 12345 or +91 98460 12345"
                      value={bookPhone}
                      onChange={(e) => {
                        e.target.setCustomValidity('');
                        setBookPhone(e.target.value);
                      }}
                      className="w-full h-11 sm:h-12 pl-9 pr-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm text-[#16191E] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all duration-150"
                    />
                    <Phone className="w-4 h-4 absolute left-3 top-3.5 pointer-events-none text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
                <div className="grid grid-cols-12 gap-2.5 sm:gap-3 sm:col-span-7 md:col-span-7">
                  <div className="col-span-5 sm:col-span-5 md:col-span-5">
                    <span className="text-xs font-semibold text-[#8A909D] block mb-1">
                      Age <span className="text-red-500">*</span>
                    </span>
                    <input
                      ref={ageInputRef}
                      type="number"
                      required
                      min="1"
                      max="120"
                      placeholder="e.g. 35"
                      value={bookAge}
                      onChange={(e) => {
                        e.target.setCustomValidity('');
                        setBookAge(e.target.value);
                      }}
                      className="w-full h-11 sm:h-12 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm text-[#16191E] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all duration-150"
                    />
                  </div>

                  <div className="col-span-7 sm:col-span-7 md:col-span-7">
                    <span className="text-xs font-semibold text-[#8A909D] block mb-1">Gender</span>
                    <div className="flex bg-[#F8F9FB] p-1 rounded-xl border border-[#ECEEF2] h-11 sm:h-12 items-center relative">
                      {(['Male', 'Female', 'Other'] as const).map((g) => {
                        const isSelected = bookGender === g;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setBookGender(g)}
                            className={`relative flex-1 h-full rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer flex items-center justify-center z-10 ${isSelected ? 'text-white' : 'text-[#8A909D] hover:text-[#16191E]'
                              }`}
                          >
                            {isSelected && (
                              <motion.div
                                layoutId="activeGenderPill"
                                className="absolute inset-0 bg-[#2563EB] rounded-lg shadow-xs -z-10"
                                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                              />
                            )}
                            <span>{g}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-5 md:col-span-5">
                  <span className="text-xs font-semibold text-[#8A909D] block mb-1">Visit Priority</span>
                  <div className="flex gap-2 sm:gap-2.5 h-11 sm:h-12">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setBookPriority('Normal')}
                      className={`flex-1 px-2.5 sm:px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${bookPriority === 'Normal'
                        ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] ring-1 ring-[#2563EB]/20 shadow-xs'
                        : 'bg-white border-[#ECEEF2] text-[#8A909D] hover:border-gray-300'
                        }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 transition-transform ${bookPriority === 'Normal' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                          }`}
                      />
                      <span>Normal</span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setBookPriority('Urgent')}
                      className={`flex-1 px-2.5 sm:px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${bookPriority === 'Urgent'
                        ? 'bg-red-50 border-red-500 text-red-600 ring-1 ring-red-500/20 shadow-xs'
                        : 'bg-white border-[#ECEEF2] text-[#8A909D] hover:border-gray-300'
                        }`}
                    >
                      <AlertTriangle className={`w-3.5 h-3.5 ${bookPriority === 'Urgent' ? 'animate-pulse' : ''}`} />
                      <span>Urgent</span>
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-xs font-semibold text-[#8A909D] block mb-1.5">Chief Complaints / Symptoms</span>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-2.5">
                  {QUICK_SYMPTOMS.map((sym) => {
                    const isSelected = bookReason === sym;
                    return (
                      <motion.button
                        key={sym}
                        type="button"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setBookReason(isSelected ? '' : sym)}
                        className={`text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${isSelected
                          ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] shadow-2xs font-bold'
                          : 'bg-white border-[#ECEEF2] text-[#5E6470] hover:border-blue-200'
                          }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-[#2563EB]" />}
                        <span>{sym}</span>
                      </motion.button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Specify custom reason or clinical remarks..."
                  value={bookReason}
                  onChange={(e) => setBookReason(e.target.value)}
                  className="w-full h-11 sm:h-12 px-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs sm:text-sm text-[#16191E] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all duration-150"
                />
              </div>
            </div>

            <div className="pt-2">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={isBookingSubmitting}
                className="w-full h-12 sm:h-13 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Ticket className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  {isBookingSubmitting
                    ? 'Allocating Slot...'
                    : `Confirm & Book Slot (${currentDateOption?.shortLabel || 'Today'}) • Token P${String(queue.length + 1).padStart(3, '0')}`}
                </span>
              </motion.button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );

  if (isStandalone) {
    return (
      <motion.div
        key="standalone-booking-view"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-[#F8F9FB] flex flex-col antialiased text-[#16191E] select-none"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <header className="bg-white border-b border-[#ECEEF2] px-3.5 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
            {config?.logo_url ? (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-[#ECEEF2] bg-white overflow-hidden flex items-center justify-center p-1 shadow-2xs flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.logo_url}
                  alt={config.clinic_name || 'Clinic Logo'}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-2xs flex-shrink-0">
                <HeartPulse className="w-5 h-5 stroke-[2.2]" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-sm sm:text-lg font-bold text-[#16191E] truncate">
                  {config?.clinic_name || 'HealthSync Clinic'}
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-50 text-[9px] sm:text-[10px] font-bold text-[#2563EB] tracking-wide uppercase flex-shrink-0">
                  Slot Booking
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-[#8A909D] font-medium flex-wrap mt-0.5">
                {config?.clinic_address && (
                  <span className="flex items-center gap-1 truncate max-w-[220px] sm:max-w-none">
                    <MapPin className="w-3 h-3 text-[#2563EB] flex-shrink-0" />
                    <span className="truncate">{config.clinic_address}</span>
                  </span>
                )}
                {config?.clinic_phone && (
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <Phone className="w-3 h-3 text-[#2563EB]" />
                    <span>{config.clinic_phone}</span>
                  </span>
                )}
                {!config?.clinic_address && !config?.clinic_phone && (
                  <span className="hidden sm:inline">
                    Live OPD Consultation Scheduling & Instant Token Assignment
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {onBackToGateway && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={onBackToGateway}
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white border border-[#ECEEF2] hover:border-gray-300 text-xs font-semibold text-[#5E6470] hover:text-[#16191E] flex items-center space-x-1 sm:space-x-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Back</span>
              </motion.button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 w-full max-w-4xl mx-auto pb-28 sm:pb-12">
          {content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="embedded-booking-view"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="w-full"
    >
      {content}
    </motion.div>
  );
}

export default SlotBookingView;
