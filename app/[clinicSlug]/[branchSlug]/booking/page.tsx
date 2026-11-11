import type { Metadata } from 'next';
import { Suspense } from 'react';
import PatientSlotBookingPortal from '@/components/PatientSlotBookingPortal';

export const metadata: Metadata = {
  title: 'Consultation Booking Portal | HealthSync',
  description: 'Book consultation slots for specific clinic branch doctors.',
};

export default function BranchBookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center" />}>
      <PatientSlotBookingPortal />
    </Suspense>
  );
}

