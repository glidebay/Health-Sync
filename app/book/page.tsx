import type { Metadata } from 'next';
import { Suspense } from 'react';
import BookSlotPageClient from './BookSlotPageClient';

export const metadata: Metadata = {
  title: 'Book a Consultation Slot | HealthSync',
  description: 'Online patient consultation appointment booking and live queue token assignment.',
};

export default function BookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center" />}>
      <BookSlotPageClient />
    </Suspense>
  );
}
