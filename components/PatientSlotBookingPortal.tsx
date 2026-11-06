'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ChevronRight,
  Share2,
  MapPin,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Award,
  ChevronLeft,
} from 'lucide-react';
import {
  enterpriseCLMSService,
  DoctorSlotsResponse,
  DoctorSlotItem,
  GuardedBookingResponse,
} from '@/lib/enterpriseCLMSService';
import { getDoctors } from '@/lib/supabaseService';
import { DbDoctor } from '@/types/database';
import { validateMobileNumber } from '@/lib/phoneValidation';
import { getTodayIST } from '@/lib/utils';
import EcgActionLoader from '@/components/loading/EcgActionLoader';

interface ConfirmedPass {
  tokenNumber: number | string;
  patientName: string;
  doctorName: string;
  specialization: string;
  regNo: string;
  scheduledTime: string;
  timeStr: string;
  dateStr: string;
  phone: string;
  appointmentId?: string;
  visitType: string;
}

export function PatientSlotBookingPortal() {
  const [doctors, setDoctors] = useState<DbDoctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIST());
  const [slotData, setSlotData] = useState<DoctorSlotsResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<DoctorSlotItem | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [visitType, setVisitType] = useState('WhatsApp Online');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collisionError, setCollisionError] = useState<string | null>(null);
  const [recommendedSlots, setRecommendedSlots] = useState<string[]>([]);
  const [confirmedPass, setConfirmedPass] = useState<ConfirmedPass | null>(null);

  useEffect(() => {
    async function loadDoctors() {
      try {
        const docs = await getDoctors();
        if (docs && docs.length > 0) {
          setDoctors(docs);
          setSelectedDoctorId(docs[0].id);
        }
      } catch (err) {
        console.error('Failed to load doctors:', err);
      }
    }
    loadDoctors();
  }, []);

  const loadSlots = useCallback(async (docId: string, date: string) => {
    if (!docId || !date) return;
    setLoadingSlots(true);
    setCollisionError(null);
    setRecommendedSlots([]);
    try {
      const data = await enterpriseCLMSService.fetchDoctorSlots(docId, date);
      setSlotData(data);
      setSelectedSlot(null);
    } catch (err) {
      console.error('Failed to fetch doctor slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      loadSlots(selectedDoctorId, selectedDate);
    }
  }, [selectedDoctorId, selectedDate, loadSlots]);

  const selectedDoctor = useMemo(() => {
    return (
      doctors.find((d) => d.id === selectedDoctorId) || {
        id: selectedDoctorId,
        full_name: 'Dr. Sunny',
        specialization: 'Consultant Physician & Diabetologist',
        reg_no: 'KMC-45892',
        consultation_fee: 500,
        daily_quota: 35,
      }
    );
  }, [doctors, selectedDoctorId]);

  const groupedSlots = useMemo(() => {
    if (!slotData?.slots) return { morning: [], afternoon: [], evening: [] };
    const morning: DoctorSlotItem[] = [];
    const afternoon: DoctorSlotItem[] = [];
    const evening: DoctorSlotItem[] = [];

    slotData.slots.forEach((s) => {
      const isPM = s.time_str.includes('PM');
      const hourPart = parseInt(s.time_str.split(':')[0], 10);
      if (!isPM || hourPart === 12) {
        if (hourPart === 12) afternoon.push(s);
        else morning.push(s);
      } else if (hourPart < 5) {
        afternoon.push(s);
      } else {
        evening.push(s);
      }
    });

    return { morning, afternoon, evening };
  }, [slotData]);

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedSlot) {
      alert('Please select an available consultation time slot.');
      return;
    }

    const validation = validateMobileNumber(phone);
    if (!validation.isValid) {
      alert(validation.errorMessage || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);
    setCollisionError(null);
    setRecommendedSlots([]);

    try {
      const res: GuardedBookingResponse = await enterpriseCLMSService.bookAppointmentGuarded({
        doctorId: selectedDoctorId,
        patientName: patientName.trim(),
        phone: phone.trim(),
        scheduledTime: selectedSlot.scheduled_time,
        visitType: visitType || 'WhatsApp Online',
        priority: priority || 'Normal',
      });

      if (!res.success) {
        if (res.error_code === 'DOUBLE_BOOKING_COLLISION') {
          setCollisionError(
            'This slot was just reserved by another patient. Please choose an alternative slot below.'
          );
          setRecommendedSlots(res.recommended_slots || []);
        } else if (res.error_code === 'QUOTA_EXCEEDED') {
          setCollisionError(
            `Doctor's maximum daily patient limit has been reached for ${selectedDate}. Please select another date.`
          );
        } else {
          setCollisionError(res.message || 'Unable to confirm slot. Please pick another time.');
        }
        loadSlots(selectedDoctorId, selectedDate);
        return;
      }

      const pass: ConfirmedPass = {
        tokenNumber: res.token_no || 'T-01',
        patientName: patientName.trim(),
        doctorName: selectedDoctor.full_name || 'Dr. Sunny',
        specialization: selectedDoctor.specialization || 'Consultant Physician',
        regNo: selectedDoctor.reg_no || 'MCI-00000',
        scheduledTime: res.scheduled_time || selectedSlot.scheduled_time,
        timeStr: selectedSlot.time_str,
        dateStr: selectedDate,
        phone: phone.trim(),
        appointmentId: res.appointment_id,
        visitType: visitType,
      };
      setConfirmedPass(pass);
    } catch (err: any) {
      console.error('Booking failed:', err);
      setCollisionError('A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!confirmedPass) return;
    const msg = `*Glidebay HealthSync Appointment Confirmation*\n\n` +
      `*Token #:* ${confirmedPass.tokenNumber}\n` +
      `*Patient:* ${confirmedPass.patientName}\n` +
      `*Doctor:* ${confirmedPass.doctorName} (${confirmedPass.specialization})\n` +
      `*Reg No:* ${confirmedPass.regNo}\n` +
      `*Date:* ${confirmedPass.dateStr}\n` +
      `*Time:* ${confirmedPass.timeStr}\n` +
      `*Channel:* ${confirmedPass.visitType}\n\n` +
      `Please arrive 10 minutes before your slot. Thank you!`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-800 py-6 sm:py-10 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <HeartPulse className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                HealthSync
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  Direct Booking
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Enterprise Multi-Doctor Slot Allocation & Live Queue Pass
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Clinic Synchronized
            </span>
            <span className="text-[11px] text-slate-400">Guarded Double-Booking Engine</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {confirmedPass ? (
            <motion.div
              key="pass"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

              <div className="text-center pt-2 pb-6 border-b border-dashed border-slate-200">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Appointment Confirmed!</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Your chamber consultation token has been generated and locked in the clinic queue.
                </p>

                <div className="mt-5 inline-flex flex-col items-center justify-center px-8 py-3 bg-blue-50 border border-blue-200/80 rounded-2xl shadow-inner">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Queue Token Number
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-blue-900 tracking-tight mt-0.5">
                    #{confirmedPass.tokenNumber}
                  </span>
                </div>
              </div>

              <div className="py-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Patient Name
                    </span>
                    <span className="text-sm font-bold text-slate-800 mt-0.5 block truncate">
                      {confirmedPass.patientName}
                    </span>
                    <span className="text-[11px] text-slate-500">{confirmedPass.phone}</span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Consulting Physician
                    </span>
                    <span className="text-sm font-bold text-slate-800 mt-0.5 block truncate">
                      {confirmedPass.doctorName}
                    </span>
                    <span className="text-[11px] text-blue-600 font-semibold block truncate">
                      Reg: {confirmedPass.regNo}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Date of Visit
                    </span>
                    <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                      {confirmedPass.dateStr}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Scheduled Slot Time
                    </span>
                    <span className="text-sm font-bold text-blue-700 mt-0.5 block">
                      {confirmedPass.timeStr}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/70 border border-amber-200/70 rounded-2xl flex items-start space-x-2.5">
                  <MapPin className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Please present this digital pass at the clinic reception desk. Free parking & Wi-Fi available at the pavilion.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Pass to WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmedPass(null);
                    setPatientName('');
                    setPhone('');
                    setSelectedSlot(null);
                    loadSlots(selectedDoctorId, selectedDate);
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  Book Another Appointment
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="booking-form"
              onSubmit={handleSubmitBooking}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                      1
                    </span>
                    Select Doctor
                  </h2>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Verified MCI/KMC Specialists
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {doctors.map((doc) => {
                    const isSelected = doc.id === selectedDoctorId;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start space-x-3 ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-400/40'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Stethoscope className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-900 truncate">
                              {doc.full_name}
                            </h3>
                            <span className="text-[11px] font-bold text-blue-700 ml-1">
                              ₹{(doc as any).consultation_fee || 500}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {doc.specialization || 'Consultant Physician'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Reg: {(doc as any).reg_no || 'MCI-00000'} • Quota: {(doc as any).daily_quota || 35}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                      2
                    </span>
                    Consultation Date & Time Slot
                  </h2>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={selectedDate}
                      min={getTodayIST()}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="text-xs font-semibold px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {slotData?.is_holiday && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center space-x-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">Doctor on Leave / Clinic Holiday</h4>
                      <p className="text-[11px] text-amber-700">
                        {slotData.reason || 'No consultation slots available on this date. Please select another date.'}
                      </p>
                    </div>
                  </div>
                )}

                {collisionError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4 space-y-2">
                    <div className="flex items-center space-x-2 text-red-700 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{collisionError}</span>
                    </div>

                    {recommendedSlots.length > 0 && (
                      <div className="pt-2 border-t border-red-200/60">
                        <span className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                          Recommended Available Slots:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {recommendedSlots.map((timeStr) => (
                            <button
                              key={timeStr}
                              type="button"
                              onClick={() => {
                                const matched = slotData?.slots.find((s) => s.time_str === timeStr);
                                if (matched) {
                                  setSelectedSlot(matched);
                                  setCollisionError(null);
                                }
                              }}
                              className="px-3 py-1 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
                            >
                              {timeStr}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {loadingSlots ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-2">
                    <EcgActionLoader size="md" />
                    <span className="text-xs text-slate-400 font-medium">
                      Loading schedule and buffer slots...
                    </span>
                  </div>
                ) : !slotData?.is_holiday && (
                  <div className="space-y-4">
                    {groupedSlots.morning.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Morning Shift (09:00 AM – 12:00 PM)
                        </span>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {groupedSlots.morning.map((s) => {
                            const isSelected = selectedSlot?.scheduled_time === s.scheduled_time;
                            const isDisabled = s.is_booked || !s.is_available || s.is_past;
                            return (
                              <button
                                key={s.scheduled_time}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setSelectedSlot(s)}
                                className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition border flex flex-col items-center ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : isDisabled
                                    ? 'bg-slate-100 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-60'
                                    : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-200 cursor-pointer'
                                }`}
                              >
                                <span>{s.time_str}</span>
                                <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                  {s.is_booked ? 'Booked' : s.is_past ? 'Past' : `${s.duration_mins}m`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {groupedSlots.afternoon.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Afternoon Shift (12:00 PM – 05:00 PM)
                        </span>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {groupedSlots.afternoon.map((s) => {
                            const isSelected = selectedSlot?.scheduled_time === s.scheduled_time;
                            const isDisabled = s.is_booked || !s.is_available || s.is_past;
                            return (
                              <button
                                key={s.scheduled_time}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setSelectedSlot(s)}
                                className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition border flex flex-col items-center ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : isDisabled
                                    ? 'bg-slate-100 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-60'
                                    : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-200 cursor-pointer'
                                }`}
                              >
                                <span>{s.time_str}</span>
                                <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                  {s.is_booked ? 'Booked' : s.is_past ? 'Past' : `${s.duration_mins}m`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                      <span>Available Slots: {slotData?.available_count ?? 0}</span>
                      <span>Daily Quota: {slotData?.daily_quota ?? 35}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                      3
                    </span>
                    Patient Details
                  </h2>
                  <span className="text-[11px] text-slate-400 font-medium">
                    100% Confidential
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        10-Digit Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="e.g. 9846012345"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Age
                        </label>
                        <input
                          type="number"
                          placeholder="30"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Gender
                        </label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as any)}
                          className="w-full px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedSlot || slotData?.is_holiday}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-600/25 transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <EcgActionLoader size="sm" />
                    <span>Reserving Slot & Securing Token...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Generate Digital Queue Token</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        <p>Glidebay HealthSync Enterprise CLMS • MCI/KMC Legal Compliance Ready</p>
      </footer>
    </div>
  );
}

export default PatientSlotBookingPortal;

