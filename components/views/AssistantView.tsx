'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Patient } from '@/types';
import { QueueList } from '@/components/reception/QueueList';
import { ReallocateStrategy } from '@/components/reception/RescheduleModal';

interface AssistantViewProps {
  queue: Patient[];
  onRegisterWalkin: () => void;
  onReallocate?: (id: string) => void;
  onCancelAppointment: (patientId: string, reason: string) => Promise<void> | void;
  onReschedulePatient: (params: {
    patientId: string;
    strategy: ReallocateStrategy;
    newSlotTime: string;
    reason: string;
    swapWithPatientId?: string;
    delayMinutes?: number;
    cascadeAll?: boolean;
    setUrgentPriority?: boolean;
  }) => Promise<void> | void;
  onStartConsultation?: (patientId: string) => void;
}

export function AssistantView({
  queue,
  onRegisterWalkin,
  onReallocate,
  onCancelAppointment,
  onReschedulePatient,
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
        onRegisterWalkin={onRegisterWalkin}
        onCancelAppointment={onCancelAppointment}
        onReschedulePatient={onReschedulePatient}
        onStartConsultation={onStartConsultation}
      />
    </motion.section>
  );
}

export default AssistantView;
