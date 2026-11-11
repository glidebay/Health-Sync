import type { Metadata } from 'next';
import { Suspense } from 'react';
import PatientSlotBookingPortal from '@/components/PatientSlotBookingPortal';

export const metadata: Metadata = {
  title: 'Consultation Booking Portal | HealthSync',
  description: 'Book consultation appointment slots across clinic branches.',
};

export default function GenericBookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center" />}>
      <PatientSlotBookingPortal />
    </Suspense>
  );
}
