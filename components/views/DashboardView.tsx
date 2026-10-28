'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye,
  Check,
  Boxes,
  Plus,
  Stethoscope,
  Clock,
  Users,
  Pill,
  CheckCircle2,
  PlusCircle,
  User,
  Phone,
} from 'lucide-react';
import { Patient } from '@/types';
import { AnimatedCounter } from '@/components/common/AnimatedCounter';
import { AnimatedProgress } from '@/components/common/AnimatedProgress';
import { staggerContainer, fadeScale } from '@/lib/constants';
import { RescheduleModal, ReallocateStrategy } from '@/components/reception/RescheduleModal';
import { CancelModal } from '@/components/reception/CancelModal';
import { formatPatientToken } from '@/lib/utils';

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
}: DashboardViewProps) {
  const [selectedPatientForReschedule, setSelectedPatientForReschedule] = useState<Patient | null>(null);
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState<Patient | null>(null);
  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
    >
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10"
      >
        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] flex justify-between items-start shadow-sm cursor-default min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-xs sm:text-sm font-semibold text-[#16191E] block mb-2 sm:mb-4 truncate">
              Total Patients Today
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#16191E] tracking-tight block">
              <AnimatedCounter target={totalPatientsCount} />
            </span>
          </div>
          <motion.div
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20 flex-shrink-0"
          >
            <Eye className="w-4 h-4 stroke-[2]" />
          </motion.div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] flex justify-between items-start shadow-sm cursor-default min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-xs sm:text-sm font-semibold text-[#16191E] block mb-2 sm:mb-4 truncate">
              Completed Consults
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#16191E] tracking-tight block">
              <AnimatedCounter target={completedPatientsCount} />
            </span>
          </div>
          <motion.div
            whileHover={{ rotate: -12, scale: 1.1 }}
            className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20 flex-shrink-0"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
          </motion.div>
        </motion.div>

        <motion.div
          variants={fadeScale}
          whileHover={{ y: -4, boxShadow: '0 14px 28px -6px rgba(0,0,0,0.08)' }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] sm:col-span-2 xl:col-span-1 flex justify-between items-start shadow-sm cursor-default min-w-0"
        >
          <div className="min-w-0 pr-2">
            <span className="text-xs sm:text-sm font-semibold text-[#16191E] block mb-2 sm:mb-4 truncate">
              Pharmacy Units in Stock
            </span>
            <span className="text-xl sm:text-2xl font-bold text-[#16191E] tracking-tight block">
              <AnimatedCounter target={totalStockUnits} />
            </span>
          </div>
          <motion.div
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-sm shadow-blue-500/20 flex-shrink-0"
          >
            <Boxes className="w-4 h-4 stroke-[2]" />
          </motion.div>
        </motion.div>
      </motion.section>

      <section className="mb-8 sm:mb-10">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-5">
          <h2 className="text-base sm:text-lg font-bold text-[#16191E] tracking-tight">
            Active consultations & Chamber Flow
          </h2>
          <motion.button
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onRegisterWalkin}
            className="flex items-center space-x-1.5 text-xs font-semibold bg-[#2563EB] text-white px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl hover:bg-blue-700 transition cursor-pointer shadow-sm flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Register Walk-in</span>
            <span className="sm:hidden">Walk-in</span>
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          <motion.div
            whileHover={{
              y: -4,
              boxShadow: '0 14px 32px -8px rgba(0,0,0,0.08)',
            }}
            className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-sm flex flex-col justify-between cursor-default min-w-0"
          >
            <motion.div
              whileHover={{ rotate: -8, scale: 1.1 }}
              className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] mb-6 sm:mb-10 flex-shrink-0"
            >
              <Stethoscope className="w-5 h-5 stroke-[1.8]" />
            </motion.div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#16191E] mb-3 truncate" title={inChamberPatient ? `${inChamberPatient.name} (In Chamber)` : undefined}>
                {inChamberPatient ? `${inChamberPatient.name} (In Chamber)` : 'No Patient in Chamber'}
              </h3>
              <div className="flex items-center justify-between gap-2.5 min-w-0">
                <AnimatedProgress percent={inChamberPatient ? 85 : 0} delay={0.1} className="flex-1 min-w-[36px] max-w-[120px]" />
                <span className="text-xs font-semibold text-[#8A909D] flex-shrink-0 whitespace-nowrap">
                  {inChamberPatient ? (
                    <>
                      <strong className="text-[#16191E]">{inChamberPatient.age}</strong> Yrs • {inChamberPatient.gender}
                    </>
                  ) : (
                    'Chamber Available'
                  )}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{
              y: -4,
              boxShadow: '0 14px 32px -8px rgba(0,0,0,0.08)',
            }}
            className="bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-sm flex flex-col justify-between cursor-default min-w-0"
          >
            <motion.div
              whileHover={{ rotate: 8, scale: 1.1 }}
              className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] mb-6 sm:mb-10 flex-shrink-0"
            >
              <Clock className="w-5 h-5 stroke-[1.8]" />
            </motion.div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#16191E] mb-3 truncate" title={nextWaitingPatient ? `${nextWaitingPatient.name} (Next)` : undefined}>
                {nextWaitingPatient ? `${nextWaitingPatient.name} (Next)` : 'No Waiting Patients'}
              </h3>
              <div className="flex items-center justify-between gap-2.5 min-w-0">
                <AnimatedProgress percent={nextWaitingPatient ? 50 : 0} delay={0.2} className="flex-1 min-w-[36px] max-w-[120px]" />
                <span className="text-xs font-semibold text-[#8A909D] flex-shrink-0 whitespace-nowrap">
                  {nextWaitingPatient ? (
                    <>
                      <strong className="text-[#16191E]">{nextWaitingPatient.time}</strong> Slot
                    </>
                  ) : (
                    'Queue Clear'
                  )}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{
              y: -4,
              boxShadow: '0 14px 32px -8px rgba(0,0,0,0.08)',
            }}
            className="md:col-span-2 xl:col-span-1 bg-white rounded-2xl p-5 sm:p-6 border border-[#ECEEF2] shadow-sm flex flex-col justify-start cursor-default min-w-0"
          >
            <h3 className="text-base font-bold text-[#16191E] mb-4">Clinic Daily Stream</h3>
            <div className="flex flex-wrap md:flex-col gap-2.5">
              <motion.div whileHover={{ scale: 1.03, x: 2 }} transition={{ type: 'spring', damping: 20 }}>
                <span className="inline-flex items-center space-x-2 bg-[#EAECEF] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#16191E] cursor-pointer">
                  <Users className="w-4 h-4 text-[#2563EB] stroke-[2]" />
                  <span>{waitingPatientsCount} Waiting in Queue</span>
                </span>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03, x: 2 }} transition={{ type: 'spring', damping: 20 }}>
                <span className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#16191E] hover:bg-gray-100 transition cursor-pointer">
                  <Pill className="w-4 h-4 text-[#2563EB] stroke-[1.8]" />
                  <span>Live Stock Synced</span>
                </span>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03, x: 2 }} transition={{ type: 'spring', damping: 20 }}>
                <span className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#16191E] hover:bg-gray-100 transition cursor-pointer">
                  <CheckCircle2 className="w-4 h-4 text-[#2563EB] stroke-[1.8]" />
                  <span>14m Avg Consultation</span>
                </span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8">
        <div className="xl:col-span-7 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-base font-bold text-[#16191E]">Live Queue Oversight</h2>
            <div className="flex items-center space-x-3.5">
              <motion.span
                whileHover={{ scale: 1.06 }}
                onClick={onViewAllQueue}
                className="text-sm font-semibold text-[#16191E] cursor-pointer hover:underline"
              >
                All
              </motion.span>
              <motion.button
                whileHover={{ scale: 1.15, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onRegisterWalkin}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-blue-50 transition text-[#2563EB] cursor-pointer"
                title="Add Walk-in"
              >
                <PlusCircle className="w-4 h-4 stroke-[2.2]" />
              </motion.button>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {filteredQueue.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-[#ECEEF2] text-center shadow-xs">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2 stroke-[1.5]" />
                <p className="text-sm font-semibold text-gray-700">No Patients in Database Queue</p>
                <p className="text-xs text-gray-400 mt-1">Register walk-in patients from Assistant Desk to populate live queue.</p>
              </div>
            ) : (
              filteredQueue.slice(0, 3).map((p) => {
                const isWaiting = p.status === 'Waiting';
                const tokenDisplay = formatPatientToken(p);

                return (
                  <motion.div
                    key={p.id}
                    whileHover={{
                      y: -2,
                      boxShadow: '0 10px 24px -6px rgba(0,0,0,0.07)',
                    }}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
                  >
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <motion.div
                        whileHover={{ rotate: 10 }}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-[#2563EB]"
                      >
                        <User className="w-5 h-5 stroke-[2]" />
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-sm font-bold text-[#16191E] truncate">{p.name}</h3>
                          <span className="text-xs text-[#8A909D] font-medium flex-shrink-0">
                            ({tokenDisplay})
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-[#5E6470] font-medium">
                          <span>
                            {p.age} Yrs • {p.gender}
                          </span>
                          {p.phone && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="inline-flex items-center gap-1 text-[#5E6470]">
                                <Phone className="w-3 h-3 text-[#2563EB]" />
                                {p.phone}
                              </span>
                            </>
                          )}
                          <span className="text-gray-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#2563EB] stroke-[2]" />
                            Slot: {p.time}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                              p.status === 'Completed'
                                ? 'bg-gray-100 text-gray-600'
                                : p.status === 'In Progress'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'Cancelled'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {p.status}
                          </span>
                          {p.visitType && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1 ${
                                p.visitType.toLowerCase().includes('whatsapp') || p.visitType.toLowerCase().includes('online')
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {p.visitType.toLowerCase().includes('whatsapp') || p.visitType.toLowerCase().includes('online') ? 'Online' : 'Walk-in'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isWaiting && (
                      <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedPatientForCancel(p)}
                          className="text-xs font-semibold px-3 py-1.5 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                        >
                          Cancel
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedPatientForReschedule(p)}
                          className="text-xs font-semibold px-3 py-1.5 border border-blue-200 text-[#2563EB] rounded-xl hover:bg-blue-50 transition cursor-pointer"
                        >
                          Reschedule
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:col-span-5 flex flex-col min-w-0">
          <h2 className="text-base font-bold text-[#16191E] mb-4 sm:mb-5">Upcoming Consultations</h2>
          <div className="space-y-3 sm:space-y-4">
            {queue.slice(2, 5).map((p) => (
              <motion.div
                key={p.id}
                whileHover={{
                  y: -3,
                  x: 4,
                  boxShadow: '0 10px 24px -6px rgba(0,0,0,0.07)',
                }}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex items-center space-x-3 sm:space-x-4 cursor-pointer min-w-0"
                onClick={() => {
                  if (isLoggedIn) onStartConsultation(p.id);
                  else onRequireLogin();
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-[#2563EB]"
                >
                  <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[#16191E] mb-0.5 truncate">{p.name}</h3>
                  <motion.span
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="text-xs text-[#8A909D] font-medium block truncate"
                  >
                    Slot: {p.time} • {p.age} Yrs
                  </motion.span>
                </div>
              </motion.div>
            ))}
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
