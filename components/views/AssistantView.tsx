'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Patient } from '@/types';
import { DbDoctor } from '@/types/database';
import { QueueList } from '@/components/reception/QueueList';
import { ReallocateStrategy } from '@/components/reception/RescheduleModal';

interface AssistantViewProps {
  queue: Patient[];
  doctors?: DbDoctor[];
  onRegisterWalkin: () => void;
  onReallocate?: (id: string) => void;
  onCancelAppointment: (patientId: string, reason: string) => Promise<void> | void;
  onReschedulePatient: (params: {
    patientId: string;
    strategy: ReallocateStrategy;
    newSlotTime: string;
    newDate?: string;
    newDoctorId?: string;
    newDoctorName?: string;
    reason: string;
    swapWithPatientId?: string;
    delayMinutes?: number;
    cascadeAll?: boolean;
    setUrgentPriority?: boolean;
  }) => Promise<void> | void;
  onReassignDoctor?: (params: {
    appointmentId: string;
    newDoctorId: string;
    newDoctorName: string;
    reason: string;
  }) => Promise<void> | void;
  onBulkReassignDoctor?: (params: {
    fromDoctorId: string;
    toDoctorId: string;
    toDoctorName: string;
    reason: string;
  }) => Promise<void> | void;
  onStartConsultation?: (patientId: string) => void;
}

export function AssistantView({
  queue,
  doctors = [],
  onRegisterWalkin,
  onReallocate,
  onCancelAppointment,
  onReschedulePatient,
  onReassignDoctor,
  onBulkReassignDoctor,
  onStartConsultation,
}: AssistantViewProps) {
  return (
    <motion.section
      key="assistant"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 sm:space-y-6"
    >
      <QueueList
        queue={queue}
        doctors={doctors}
        onRegisterWalkin={onRegisterWalkin}
        onCancelAppointment={onCancelAppointment}
        onReschedulePatient={onReschedulePatient}
        onReassignDoctor={onReassignDoctor}
        onBulkReassignDoctor={onBulkReassignDoctor}
        onStartConsultation={onStartConsultation}
      />
    </motion.section>
  );
}

export default AssistantView;
