import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PatientSlotBookingPortal } from '@/components/PatientSlotBookingPortal';

export const metadata: Metadata = {
  title: 'Book Doctor Consultation | HealthSync Patient Portal',
  description: 'Instant multi-doctor appointment booking, real-time slot allocation, and digital queue pass.',
};

export default function PatientRequestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center" />}>
      <PatientSlotBookingPortal />
    </Suspense>
  );
}

