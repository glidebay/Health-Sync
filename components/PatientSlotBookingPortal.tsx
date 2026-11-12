'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartPulse,
  Stethoscope,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Share2,
  MapPin,
  RefreshCw,
  Copy,
  Check,
  Building2,
  ExternalLink,
  Award,
  Sparkles,
  Info,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { validateMobileNumber } from '@/lib/phoneValidation';
import { getTodayIST } from '@/lib/utils';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

export interface ResolvedClinic {
  id: string;
  name: string;
  slug: string;
}

export interface ResolvedBranch {
  id: string;
  branch_id?: string;
  branch_name: string;
  branch_code?: string;
  branch_slug?: string;
  booking_url?: string;
  address?: string;
  landmark?: string;
  phone?: string;
  map_link?: string | null;
}

export interface ResolvedDoctor {
  id: string;
  full_name: string;
  specialization: string;
  reg_no?: string;
  daily_quota?: number;
  consultation_fee?: number;
  phone?: string;
  is_admin_doctor?: boolean;
  is_active?: boolean;
}

export interface AvailableSlotItem {
  scheduled_time: string;
  time_str: string;
  duration_mins?: number;
  is_available: boolean;
  is_booked?: boolean;
  is_past?: boolean;
}

export interface BookingConfirmation {
  success: boolean;
  token_display: string;
  appointment_id?: string;
  patient_name: string;
  phone_number: string;
  doctor_name: string;
  clinic_name: string;
  branch_name: string;
  branch_address?: string;
  branch_landmark?: string;
  branch_phone?: string;
  assigned_slot: string;
  scheduled_time?: string;
  booking_url?: string;
  visit_type?: string;
}

interface PatientSlotBookingPortalProps {
  initialClinicSlug?: string;
  initialBranchSlug?: string;
}

export function PatientSlotBookingPortal({
  initialClinicSlug,
  initialBranchSlug,
}: PatientSlotBookingPortalProps = {}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Extract clinicSlug and branchSlug from params, path or query
  const clinicSlug = useMemo(() => {
    if (initialClinicSlug) return initialClinicSlug;
    if (params?.clinicSlug) return String(params.clinicSlug);
    const qClinic = searchParams.get('clinic') || searchParams.get('clinicSlug');
    if (qClinic) return qClinic;

    // Check pathname parsing: /<clinicSlug>/<branchSlug>/booking or /<clinicSlug>/booking
    if (pathname) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[parts.length - 1] === 'booking') {
        return parts[0];
      }
    }
    return '';
  }, [initialClinicSlug, params, searchParams, pathname]);

  const branchSlug = useMemo(() => {
    if (initialBranchSlug) return initialBranchSlug;
    if (params?.branchSlug) return String(params.branchSlug);
    const qBranch = searchParams.get('branch') || searchParams.get('branchSlug') || searchParams.get('code');
    if (qBranch) return qBranch;

    if (pathname) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 3 && parts[parts.length - 1] === 'booking') {
        return parts[1];
      }
    }
    return '';
  }, [initialBranchSlug, params, searchParams, pathname]);

  // Resolution state
  const [isResolving, setIsResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [clinic, setClinic] = useState<ResolvedClinic | null>(null);
  const [branch, setBranch] = useState<ResolvedBranch | null>(null);
  const [doctors, setDoctors] = useState<ResolvedDoctor[]>([]);

  // Booking form state
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIST());
  const [availableSlots, setAvailableSlots] = useState<AvailableSlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotItem | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotMeta, setSlotMeta] = useState<{
    dailyQuota?: number;
    bookedCount?: number;
    availableCount?: number;
    isHoliday?: boolean;
  }>({});

  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // 1. Resolve clinic, branch and doctors via RPC
  const resolvePortal = useCallback(async () => {
    setIsResolving(true);
    setResolveError(null);

    try {
      let targetClinicSlug = clinicSlug.trim();
      let targetBranchSlug = branchSlug.trim();

      // If no slugs provided, fallback to primary clinic branding
      if (!targetClinicSlug) {
        const { data: brandingData, error: brandingErr } = await supabase.rpc('get_clinic_branding_master');
        if (!brandingErr && brandingData?.primary_location) {
          const loc = brandingData.primary_location;
          targetBranchSlug = loc.branch_slug || loc.id;
          targetClinicSlug = loc.clinic_slug || (loc.booking_url ? loc.booking_url.split('/')[1] : 'aster-prime-clinic');
        } else {
          targetClinicSlug = 'aster-prime-clinic';
          targetBranchSlug = 'edappally-hub';
        }
      }

      const { data, error } = await supabase.rpc('resolve_booking_portal_by_slug', {
        p_clinic_slug: targetClinicSlug,
        p_branch_slug: targetBranchSlug || null,
      });

      if (error || !data || data.success === false) {
        setResolveError(
          data?.message ||
            error?.message ||
            `Unable to resolve booking portal for "${targetClinicSlug}${targetBranchSlug ? '/' + targetBranchSlug : ''}". Please check the link or contact clinic reception.`
        );
        return;
      }

      setClinic(data.clinic);
      setBranch(data.branch);
      const branchDocs = Array.isArray(data.doctors) ? data.doctors : [];
      setDoctors(branchDocs);
      if (branchDocs.length > 0) {
        setSelectedDoctorId(branchDocs[0].id);
      }
    } catch (err: any) {
      console.error('Portal slug resolution failed:', err);
      setResolveError('A network error occurred while resolving clinic details.');
    } finally {
      setIsResolving(false);
    }
  }, [clinicSlug, branchSlug]);

  useEffect(() => {
    resolvePortal();
  }, [resolvePortal]);

  // 2. Fetch available slots when selectedDoctor or selectedDate changes
  const loadAvailableSlots = useCallback(async (doctorId: string, date: string, branchId?: string) => {
    if (!doctorId || !date) return;
    setIsLoadingSlots(true);
    setSubmitError(null);

    try {
      // 1. Try get_doctor_available_slots RPC
      const { data: slotRes, error: slotErr } = await supabase.rpc('get_doctor_available_slots', {
        p_doctor_id: doctorId,
        p_date: date,
      });

      if (!slotErr && slotRes && slotRes.slots) {
        const slots: AvailableSlotItem[] = (slotRes.slots || []).map((s: any) => ({
          scheduled_time: s.scheduled_time,
          time_str: s.time_str,
          duration_mins: s.duration_mins || 15,
          is_available: s.is_available !== false && !s.is_booked && !s.is_past,
          is_booked: Boolean(s.is_booked),
          is_past: Boolean(s.is_past),
        }));
        setAvailableSlots(slots);
        setSlotMeta({
          dailyQuota: slotRes.daily_quota,
          bookedCount: slotRes.booked_count,
          availableCount: slotRes.available_count,
          isHoliday: slotRes.is_holiday,
        });
        setSelectedSlot(null);
        return;
      }

      // 2. Fallback to get_branch_open_slots if locationId available
      if (branchId) {
        const { data: branchSlots, error: bErr } = await supabase.rpc('get_branch_open_slots', {
          p_location_id: branchId,
          p_date: date,
          p_doctor_id: doctorId,
        });

        if (!bErr && branchSlots && Array.isArray(branchSlots.slots)) {
          const slots: AvailableSlotItem[] = branchSlots.slots.map((s: any) => ({
            scheduled_time: s.scheduled_time,
            time_str: s.time_str,
            is_available: true,
          }));
          setAvailableSlots(slots);
          setSlotMeta({
            availableCount: branchSlots.total_open,
          });
          setSelectedSlot(null);
          return;
        }
      }

      setAvailableSlots([]);
    } catch (err) {
      console.warn('Failed to load slots:', err);
      setAvailableSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      loadAvailableSlots(selectedDoctorId, selectedDate, branch?.id);
    }
  }, [selectedDoctorId, selectedDate, branch?.id, loadAvailableSlots]);

  const selectedDoctor = useMemo(() => {
    return doctors.find((d) => d.id === selectedDoctorId) || doctors[0] || null;
  }, [doctors, selectedDoctorId]);

  // Group slots by time of day
  const groupedSlots = useMemo(() => {
    const morning: AvailableSlotItem[] = [];
    const afternoon: AvailableSlotItem[] = [];
    const evening: AvailableSlotItem[] = [];

    availableSlots.forEach((slot) => {
      const isPM = slot.time_str.includes('PM');
      const hourPart = parseInt(slot.time_str.split(':')[0], 10);
      if (!isPM || hourPart === 12) {
        if (hourPart === 12) afternoon.push(slot);
        else morning.push(slot);
      } else if (hourPart < 5) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    return { morning, afternoon, evening };
  }, [availableSlots]);

  // 3. Handle reservation submission
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedDoctor || !branch) return;

    if (!selectedSlot) {
      setSubmitError('Please pick an available consultation time slot.');
      return;
    }

    const cleanPhone = patientPhone.trim();
    const validation = validateMobileNumber(cleanPhone);
    if (!validation.isValid) {
      setSubmitError(validation.errorMessage || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!patientName.trim()) {
      setSubmitError('Patient full name is mandatory.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: res, error: rpcErr } = await supabase.rpc('confirm_whatsapp_booking', {
        p_doctor_id: selectedDoctor.id,
        p_patient_name: patientName.trim(),
        p_phone_number: cleanPhone,
        p_scheduled_time: selectedSlot.scheduled_time,
        p_priority: priority || 'Normal',
        p_location_id: branch.id, // Critical: enforces doctor-branch validation and queue isolation
      });

      if (rpcErr || !res || res.success === false) {
        setSubmitError(
          res?.error_message ||
            res?.message ||
            rpcErr?.message ||
            'Unable to reserve slot. It may have just been booked. Please choose another time.'
        );
        loadAvailableSlots(selectedDoctor.id, selectedDate, branch.id);
        return;
      }

      setConfirmation({
        success: true,
        token_display: res.token_display || `P0${res.queue_token_no || 1}`,
        appointment_id: res.appointment_id,
        patient_name: patientName.trim(),
        phone_number: cleanPhone,
        doctor_name: res.doctor_name || selectedDoctor.full_name,
        clinic_name: res.clinic_name || clinic?.name || 'Clinic',
        branch_name: res.branch_name || branch.branch_name,
        branch_address: res.branch_address || branch.address,
        branch_landmark: res.branch_landmark || branch.landmark,
        branch_phone: res.branch_phone || branch.phone,
        assigned_slot: res.assigned_slot || selectedSlot.time_str,
        scheduled_time: res.scheduled_time || selectedSlot.scheduled_time,
        booking_url: res.booking_url || branch.booking_url || pathname || window.location.pathname,
        visit_type: res.visit_type || 'Direct Booking',
      });
    } catch (err: any) {
      console.error('Booking failed:', err);
      setSubmitError('An unexpected network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyBookingUrl = () => {
    const url = confirmation?.booking_url || branch?.booking_url || (typeof window !== 'undefined' ? window.location.href : '');
    const fullUrl = url.startsWith('http') ? url : `${typeof window !== 'undefined' ? window.location.origin : ''}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!confirmation) return;
    const msg =
      `*Appointment Confirmed: ${confirmation.clinic_name}*\n\n` +
      `*Token #:* ${confirmation.token_display}\n` +
      `*Patient:* ${confirmation.patient_name}\n` +
      `*Doctor:* ${confirmation.doctor_name}\n` +
      `*Branch:* ${confirmation.branch_name}\n` +
      (confirmation.branch_address ? `*Address:* ${confirmation.branch_address}\n` : '') +
      (confirmation.branch_phone ? `*Clinic Contact:* ${confirmation.branch_phone}\n` : '') +
      `*Slot Time:* ${confirmation.assigned_slot} (${selectedDate})\n` +
      `*Channel:* ${confirmation.visit_type || 'Direct Booking'}\n\n` +
      `Please report to the reception 10 minutes prior to your allocated slot. Thank you!`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Loading screen
  if (isResolving) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center p-6 text-center">
        <EcgActionLoader isLoading={true} text="Resolving Clinic Branch & Doctors..." />
      </div>
    );
  }

  // Error Card if clinic or branch resolution failed
  if (resolveError || !clinic || !branch) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4 sm:p-6 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl border border-rose-200 p-6 sm:p-8 max-w-md w-full text-center shadow-xl space-y-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
            <AlertTriangle className="w-7 h-7 stroke-[2]" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Branch Portal Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {resolveError || 'The requested clinic branch could not be verified. Please check the URL path or verify with clinic reception.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => resolvePortal()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Resolution</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Confirmation View
  if (confirmation) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] text-slate-800 py-8 px-4 sm:px-6 flex flex-col justify-center items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full bg-white rounded-3xl border border-emerald-200/90 shadow-xl overflow-hidden"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 sm:p-8 text-white text-center relative overflow-hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md mb-3 border border-white/30 shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">Appointment Confirmed!</h2>
            <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-1">
              {confirmation.clinic_name} &bull; {confirmation.branch_name}
            </p>

            <div className="mt-5 inline-block bg-white text-slate-900 rounded-2xl px-6 py-2.5 shadow-lg border border-emerald-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Queue Token Number</span>
              <span className="text-3xl font-black text-emerald-600 tracking-tight font-mono">
                {confirmation.token_display}
              </span>
            </div>
          </div>

          {/* Details Body */}
          <div className="p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Consulting Doctor</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{confirmation.doctor_name}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Allocated Time Slot</span>
                <span className="font-bold text-[#2563EB] mt-0.5 block">{confirmation.assigned_slot}</span>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-start gap-2 text-slate-600">
                <Building2 className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">{confirmation.branch_name}</strong>
                  {confirmation.branch_address && <p className="text-[11px] text-slate-500 mt-0.5">{confirmation.branch_address}</p>}
                  {confirmation.branch_landmark && (
                    <p className="text-[11px] text-slate-400 italic">Landmark: {confirmation.branch_landmark}</p>
                  )}
                </div>
              </div>

              {confirmation.branch_phone && (
                <div className="flex items-center gap-2 text-slate-600 pt-1 border-t border-slate-200/60">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-700">{confirmation.branch_phone}</span>
                </div>
              )}
            </div>

            {/* Dedicated Branch Link */}
            {confirmation.booking_url && (
              <div className="flex items-center justify-between gap-2 p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs">
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-[10px] text-blue-700 font-bold block uppercase tracking-wider">Branch Portal Link</span>
                  <span className="font-mono text-[11px] text-blue-900 truncate block">{confirmation.booking_url}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyBookingUrl}
                  className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold text-xs shadow-2xs hover:bg-blue-50 transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  setSelectedSlot(null);
                  setPatientName('');
                  setPatientPhone('');
                }}
                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Book Another Slot
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Active Booking Form View
  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-800 py-6 sm:py-10 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full">
        {/* Dynamic Branch Isolated Header Banner */}
        <div className="bg-white rounded-3xl border border-[#ECEEF2] p-5 sm:p-6 shadow-2xs mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#2563EB] flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
                <HeartPulse className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                    {clinic.name}
                  </h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-[#2563EB] px-2 py-0.5 rounded-full">
                    {branch.branch_code || 'Direct Portal'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  {branch.branch_name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Branch Isolated
              </span>
            </div>
          </div>

          {/* Branch Physical Details Bar */}
          <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-1.5 min-w-0">
              <MapPin className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
              <div className="min-w-0 truncate">
                <span className="font-semibold text-slate-800">{branch.branch_name}</span>
                {branch.address && <span className="text-slate-400 ml-1.5 truncate">({branch.address})</span>}
                {branch.landmark && (
                  <span className="text-slate-400 block text-[11px] italic">Near {branch.landmark}</span>
                )}
              </div>
            </div>

            {branch.phone && (
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold flex-shrink-0">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{branch.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Booking Form Card */}
        <form onSubmit={handleSubmitBooking} className="bg-white rounded-3xl border border-[#ECEEF2] p-5 sm:p-7 shadow-xs space-y-6">
          {submitError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{submitError}</span>
            </motion.div>
          )}

          {/* 1. Select Consulting Doctor (Filtered strictly to this branch) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Select Attending Physician ({doctors.length} at this branch)</span>
            </label>

            {doctors.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
                No doctors currently allocated to this branch.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {doctors.map((doc) => {
                  const isSelected = selectedDoctorId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 select-none ${
                        isSelected
                          ? 'bg-blue-50/80 border-[#2563EB] ring-2 ring-blue-500/20 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isSelected ? 'bg-[#2563EB] text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {doc.full_name.replace(/^dr\.?\s+/i, '').charAt(0) || 'D'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{doc.full_name}</h4>
                          {doc.is_admin_doctor && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                              Lead
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#2563EB] font-semibold truncate mt-0.5">
                          {doc.specialization}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                          <span>Reg: {doc.reg_no || 'Verified'}</span>
                          {doc.daily_quota && <span>&bull; Cap: {doc.daily_quota}/day</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Select Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Consultation Date</span>
            </label>
            <input
              type="date"
              required
              min={getTodayIST()}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-64 px-4 py-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden shadow-2xs"
            />
          </div>

          {/* 3. Slot Availability Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Available Consultation Slots</span>
              </label>

              {slotMeta.availableCount !== undefined && (
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                  {slotMeta.availableCount} Open Slots
                </span>
              )}
            </div>

            {isLoadingSlots ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
                <span>Synchronizing live slot availability...</span>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl">
                No consultation slots open for the selected date. Please pick another date or doctor.
              </div>
            ) : (
              <div className="space-y-4">
                {groupedSlots.morning.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Morning (9:00 AM – 12:00 PM)
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {groupedSlots.morning.map((slot) => {
                        const isSelected = selectedSlot?.scheduled_time === slot.scheduled_time;
                        return (
                          <button
                            key={slot.scheduled_time}
                            type="button"
                            disabled={!slot.is_available}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center border cursor-pointer select-none ${
                              isSelected
                                ? 'bg-[#2563EB] text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                                : slot.is_available
                                ? 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {slot.time_str}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {groupedSlots.afternoon.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Afternoon (12:00 PM – 5:00 PM)
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {groupedSlots.afternoon.map((slot) => {
                        const isSelected = selectedSlot?.scheduled_time === slot.scheduled_time;
                        return (
                          <button
                            key={slot.scheduled_time}
                            type="button"
                            disabled={!slot.is_available}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center border cursor-pointer select-none ${
                              isSelected
                                ? 'bg-[#2563EB] text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                                : slot.is_available
                                ? 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {slot.time_str}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {groupedSlots.evening.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Evening (5:00 PM – 8:00 PM)
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {groupedSlots.evening.map((slot) => {
                        const isSelected = selectedSlot?.scheduled_time === slot.scheduled_time;
                        return (
                          <button
                            key={slot.scheduled_time}
                            type="button"
                            disabled={!slot.is_available}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center border cursor-pointer select-none ${
                              isSelected
                                ? 'bg-[#2563EB] text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                                : slot.is_available
                                ? 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                            }`}
                          >
                            {slot.time_str}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Patient Contact Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Patient Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number (10 digits) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9847123456"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Age</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  placeholder="e.g. 32"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent / Emergency</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Reservation Button */}
          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || !selectedSlot}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Reserving Slot &amp; Generating Pass...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Confirm Booking &bull; {selectedSlot ? selectedSlot.time_str : 'Select Time Slot'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <span>&copy; {new Date().getFullYear()} GlideBay HealthSync &bull; Multi-Clinic Branch Portal</span>
        </div>
      </div>
    </div>
  );
}

export default PatientSlotBookingPortal;
