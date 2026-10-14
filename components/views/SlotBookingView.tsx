'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeartPulse,
  Users,
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Check,
  Search,
  PlusCircle,
  CalendarPlus,
  ArrowLeft,
  Ticket,
  Printer,
  Phone,
} from 'lucide-react';
import { Patient, ConfirmedToken } from '@/types';
import { DbDoctor } from '@/types/database';
import { AVAILABLE_SLOTS, QUICK_SYMPTOMS, staggerContainer, fadeScale } from '@/lib/constants';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { AnimatedProgress } from '@/components/common/AnimatedProgress';

interface SlotBookingViewProps {
  queue: Patient[];
  waitingPatientsCount: number;
  doctorProfile: { name: string; title: string };
  availableDoctors: DbDoctor[];
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
  waitingPatientsCount,
  doctorProfile,
  availableDoctors,
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
  onGoToConsulting,
  isStandalone = false,
}: SlotBookingViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'All' | 'Morning' | 'Afternoon' | 'Evening'>('All');
  const [scheduleSearch, setScheduleSearch] = useState('');

  const filteredSlots = AVAILABLE_SLOTS.filter(
    (slot) => selectedPeriod === 'All' || slot.period === selectedPeriod
  );

  const filteredQueue = queue.filter(
    (p) =>
      p.name.toLowerCase().includes(scheduleSearch.toLowerCase()) ||
      p.id.toLowerCase().includes(scheduleSearch.toLowerCase()) ||
      (p.phone && p.phone.includes(scheduleSearch))
  );

  const content = (
    <div className="w-full space-y-6">
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4"
      >
        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-[#ECEEF2] shadow-sm cursor-default"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#8A909D] uppercase tracking-wider">Next Token</span>
            <motion.div
              whileHover={{ rotate: 12, scale: 1.1 }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shadow-2xs"
            >
              <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
            </motion.div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-[#16191E]">
            #<AnimatedCounter target={queue.length + 1} />
          </div>
          <div className="flex items-center space-x-1.5 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] sm:text-[10px] text-emerald-600 font-bold">Live OPD Issuer</span>
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-[#ECEEF2] shadow-sm cursor-default"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#8A909D] uppercase tracking-wider">Queue Waiting</span>
            <motion.div
              whileHover={{ rotate: -12, scale: 1.1 }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
            </motion.div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-[#16191E]">
            <AnimatedCounter target={waitingPatientsCount} />
          </div>
          <div className="mt-2">
            <AnimatedProgress
              percent={Math.min(100, Math.max(12, waitingPatientsCount * 16))}
              delay={0.15}
              className="w-full h-1.5"
            />
            <span className="text-[9px] sm:text-[10px] text-[#8A909D] font-medium block mt-1 truncate">
              Patients in chamber queue
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-[#ECEEF2] shadow-sm cursor-default"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#8A909D] uppercase tracking-wider">Consulting Doctor</span>
            <motion.div
              whileHover={{ rotate: 12, scale: 1.1 }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shadow-2xs"
            >
              <Stethoscope className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
            </motion.div>
          </div>
          <div className="text-xs sm:text-base font-bold text-[#16191E] truncate">{doctorProfile.name}</div>
          <span className="text-[9px] sm:text-[10px] text-[#8A909D] font-medium truncate block mt-0.5">
            {doctorProfile.title}
          </span>
          <div className="flex items-center space-x-1.5 mt-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[9px] sm:text-[10px] text-blue-600 font-bold truncate">Chamber Available</span>
          </div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-[#ECEEF2] shadow-sm cursor-default"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-[#8A909D] uppercase tracking-wider">Est. Wait Time</span>
            <motion.div
              whileHover={{ rotate: -12, scale: 1.1 }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
            </motion.div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-[#16191E]">
            ~<AnimatedCounter target={Math.max(5, waitingPatientsCount * 10)} />m
          </div>
          <div className="mt-2">
            <AnimatedProgress
              percent={Math.min(100, Math.max(15, (waitingPatientsCount * 10 / 60) * 100))}
              delay={0.25}
              className="w-full h-1.5"
            />
            <span className="text-[9px] sm:text-[10px] text-blue-600 font-bold block mt-1">
              ~10 mins / consult
            </span>
          </div>
        </motion.div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {confirmedToken ? (
              <motion.div
                key="confirmed-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-md text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
                </div>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold tracking-wide uppercase mb-2">
                  Slot Confirmed & Token Generated
                </div>
                <h3 className="text-xl font-bold text-[#16191E] mb-1">Appointment Successfully Booked</h3>
                <p className="text-xs text-[#8A909D] mb-6">Present this token at the reception or clinical waiting lounge</p>

                <div className="bg-[#F8F9FB] rounded-2xl p-6 border border-[#ECEEF2] max-w-md mx-auto mb-6 text-left">
                  <div className="flex items-center justify-between pb-4 border-b border-[#ECEEF2]">
                    <div>
                      <span className="text-[11px] font-bold text-[#8A909D] uppercase tracking-wider block">OPD Token Number</span>
                      <span className="text-3xl font-black text-[#2563EB]">#{confirmedToken.tokenNumber}</span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${confirmedToken.priority === 'Urgent'
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'bg-blue-50 text-[#2563EB] border border-blue-100'
                        }`}
                    >
                      {confirmedToken.priority} Visit
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 text-xs">
                    <div>
                      <span className="text-[#8A909D] font-medium block">Patient Name</span>
                      <span className="font-bold text-[#16191E]">{confirmedToken.name}</span>
                    </div>
                    <div>
                      <span className="text-[#8A909D] font-medium block">Scheduled Time</span>
                      <span className="font-bold text-[#16191E]">{confirmedToken.time}</span>
                    </div>
                    <div>
                      <span className="text-[#8A909D] font-medium block">Consulting Doctor</span>
                      <span className="font-bold text-[#16191E]">{confirmedToken.doctorName}</span>
                    </div>
                    <div>
                      <span className="text-[#8A909D] font-medium block">Phone / Contact</span>
                      <span className="font-bold text-[#16191E]">{confirmedToken.phone || 'Walk-in Desk'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => window.print()}
                    className="px-5 py-2.5 rounded-xl bg-white border border-[#ECEEF2] hover:bg-gray-50 text-xs font-bold text-[#16191E] flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-4 h-4 text-gray-600" />
                    <span>Print Token Slip</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setConfirmedToken(null)}
                    className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Book Another Slot</span>
                  </motion.button>

                  {onGoToConsulting && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={onGoToConsulting}
                      className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#16191E] flex items-center space-x-1.5 transition cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-gray-600" />
                      <span>View Live Queue</span>
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="booking-form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                onSubmit={handleBookSlotSubmit}
                className="bg-white rounded-3xl p-6 sm:p-7 border border-[#ECEEF2] shadow-xs space-y-6"
              >
                <div className="flex items-center justify-between pb-4 border-b border-[#ECEEF2]">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#16191E]">Book a Consultation Slot</h3>
                    <p className="text-xs text-[#8A909D]">Choose your preferred consultation time & register patient</p>
                  </div>
                  <motion.div
                    whileHover={{ rotate: 12, scale: 1.1 }}
                    className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-2xs"
                  >
                    <CalendarPlus className="w-5 h-5 stroke-[2.2]" />
                  </motion.div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-[#16191E] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>1. Select Time Slot</span>
                    </label>
                    <div className="flex items-center space-x-1 bg-[#F8F9FB] p-1 rounded-lg border border-[#ECEEF2]">
                      {(['All', 'Morning', 'Afternoon', 'Evening'] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setSelectedPeriod(period)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer ${
                            selectedPeriod === period
                              ? 'bg-white text-[#2563EB] shadow-2xs'
                              : 'text-[#8A909D] hover:text-[#16191E]'
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 bg-[#F8F9FB] rounded-2xl border border-[#ECEEF2]">
                    {filteredSlots.map((slot, sIdx) => {
                      const isSelected = bookSlotTime === slot.time;
                      return (
                        <motion.button
                          key={slot.time}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 + sIdx * 0.02 }}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => setBookSlotTime(slot.time)}
                          className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-[#2563EB] text-white shadow-xs'
                              : 'bg-white hover:bg-blue-50/60 text-[#16191E] border border-[#ECEEF2] hover:border-blue-200'
                          }`}
                        >
                          <span>{slot.time}</span>
                          <span className={`text-[9px] font-medium ${isSelected ? 'text-blue-100' : 'text-[#8A909D]'}`}>
                            {slot.period}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {availableDoctors.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-[#16191E] block mb-1.5 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>2. Consulting Physician</span>
                    </label>
                    <select
                      value={bookDoctorId}
                      onChange={(e) => setBookDoctorId(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs font-semibold text-[#16191E] outline-none focus:ring-1 focus:ring-[#2563EB]"
                    >
                      {availableDoctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.full_name} • {doc.specialization || 'General Medicine'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3.5 pt-2 border-t border-[#ECEEF2]">
                  <label className="text-xs font-bold text-[#16191E] block flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>3. Patient Information</span>
                  </label>

                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Patient Full Name *"
                      value={bookName}
                      onChange={(e) => setBookName(e.target.value)}
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:ring-1 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="Phone Number (e.g. 98460 12345)"
                        value={bookPhone}
                        onChange={(e) => setBookPhone(e.target.value)}
                        className="w-full p-2.5 pl-8 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:ring-1 focus:ring-[#2563EB]"
                      />
                      <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3 pointer-events-none" />
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Age"
                        value={bookAge}
                        onChange={(e) => setBookAge(e.target.value)}
                        className="w-20 p-2.5 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:ring-1 focus:ring-[#2563EB]"
                      />
                      <div className="flex-1 flex bg-[#F8F9FB] p-1 rounded-xl border border-[#ECEEF2]">
                        {(['Male', 'Female', 'Other'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setBookGender(g)}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${bookGender === g
                                ? 'bg-[#2563EB] text-white shadow-xs'
                                : 'text-[#8A909D] hover:text-[#16191E]'
                              }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[#8A909D] block mb-1">Visit Priority</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setBookPriority('Normal')}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 ${bookPriority === 'Normal'
                            ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                            : 'bg-white border-[#ECEEF2] text-[#8A909D] hover:border-gray-300'
                          }`}
                      >
                        <Check className={`w-3.5 h-3.5 ${bookPriority === 'Normal' ? 'opacity-100' : 'opacity-0'}`} />
                        <span>Normal Walk-in</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBookPriority('Urgent')}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 ${bookPriority === 'Urgent'
                            ? 'bg-red-50 border-red-500 text-red-600'
                            : 'bg-white border-[#ECEEF2] text-[#8A909D] hover:border-gray-300'
                          }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Urgent Triage</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[#8A909D] block mb-1.5">Reason for Visit / Symptoms</span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {QUICK_SYMPTOMS.map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => setBookReason(sym)}
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer ${bookReason === sym
                              ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                              : 'bg-white border-[#ECEEF2] text-[#5E6470] hover:border-blue-200'
                            }`}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Specify custom notes or reason..."
                      value={bookReason}
                      onChange={(e) => setBookReason(e.target.value)}
                      className="w-full p-2 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-xs text-[#16191E] outline-none focus:ring-1 focus:ring-[#2563EB]"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isBookingSubmitting}
                  className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{isBookingSubmitting ? 'Allocating Slot...' : `Confirm & Generate Token #${queue.length + 1}`}</span>
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
          className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-[#ECEEF2] shadow-xs"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#ECEEF2] mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#16191E]">Today's Live Queue</h3>
              <p className="text-[11px] text-[#8A909D]">Real-time OPD token status</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[10px] font-bold text-[#2563EB]">
              {queue.length} Registered
            </span>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by name, token or phone..."
              value={scheduleSearch}
              onChange={(e) => setScheduleSearch(e.target.value)}
              className="w-full py-1.5 pl-8 pr-3 bg-[#F8F9FB] border border-[#ECEEF2] rounded-xl text-[11px] outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {filteredQueue.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#8A909D]">
                No patients found in today's worklist.
              </div>
            ) : (
              filteredQueue.map((pat, idx) => (
                <motion.div
                  key={pat.id || idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.04 }}
                  whileHover={{ y: -2, boxShadow: '0 6px 16px -4px rgba(0,0,0,0.06)' }}
                  className="p-3 bg-[#F8F9FB] hover:bg-blue-50/40 rounded-2xl border border-[#ECEEF2] flex items-center justify-between transition cursor-default"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-8 h-8 rounded-xl bg-white border border-[#ECEEF2] flex items-center justify-center text-xs font-black text-[#2563EB] shadow-2xs">
                      #{pat.tokenNumber || idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-[#16191E] flex items-center gap-1.5">
                        <span>{pat.name}</span>
                        {pat.priority === 'Urgent' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-600 font-extrabold">
                            URGENT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#8A909D] font-medium">
                        {pat.age}y • {pat.gender} • Slot: {pat.time || 'Walk-in'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      pat.status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : pat.status === 'In Progress'
                        ? 'bg-blue-50 text-[#2563EB] border border-blue-200 animate-pulse'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {pat.status}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
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
        <header className="bg-white border-b border-[#ECEEF2] px-3.5 sm:px-8 py-3 sm:py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-2xs flex-shrink-0">
              <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm sm:text-lg font-bold text-[#16191E]">HealthSync</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[9px] sm:text-[10px] font-bold text-[#2563EB] tracking-wide uppercase">
                  Slot Booking
                </span>
              </div>
              <p className="text-[11px] text-[#8A909D] font-medium hidden sm:block">
                Live OPD Consultation Scheduling & Instant Token Assignment
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {onBackToGateway && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={onBackToGateway}
                className="px-2.5 sm:px-4 py-2 rounded-xl bg-white border border-[#ECEEF2] hover:border-gray-300 text-xs font-semibold text-[#5E6470] hover:text-[#16191E] flex items-center space-x-1.5 transition cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Back<span className="hidden sm:inline">&nbsp;to Selection</span></span>
              </motion.button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-28 sm:pb-8">
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
