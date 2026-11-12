'use client';

import React from 'react';
import { FrameSequenceHero, type FrameSequenceStep } from '@/components/ui/mac-book-neo-hero';

/* ─────────────────────────────────────────────────
   MacBook Neo 360° frame sequence (941 frames)
   Source: github.com/duthiljean/hero-apple
───────────────────────────────────────────────── */
const FRAME_COUNT = 941;
const framePath = (i: number) =>
  `https://cdn.jsdelivr.net/gh/duthiljean/hero-apple@main/frames/frame_${String(i).padStart(4, '0')}.jpg`;

/* ─────────────────────────────────────────────────
   HealthSync CLMS — Scroll-driven feature steps
───────────────────────────────────────────────── */
const steps: FrameSequenceStep[] = [
  {
    from: 0.02,
    to: 0.28,
    color: '#e93362',
    num: '01',
    total: '04',
    icon: '🏥',
    title: 'Real-Time Queue Management.',
    description:
      'Monitor live patient queues across all branches. Know exactly who is waiting, for how long, and with which doctor — updated every second.',
    label: 'Queue',
  },
  {
    from: 0.28,
    to: 0.55,
    color: '#ff9f3a',
    num: '02',
    total: '04',
    icon: '📱',
    title: 'WhatsApp-Driven Bookings.',
    description:
      'Patients book, cancel, and get reminders entirely via WhatsApp. No app download, no login — just a message.',
    label: 'Bookings',
  },
  {
    from: 0.55,
    to: 0.82,
    color: '#5e9bff',
    num: '03',
    total: '04',
    icon: '🏢',
    title: 'Multi-Branch Doctor Chambers.',
    description:
      'Manage unlimited clinic branches, doctor schedules, and specialty chambers from one unified dashboard.',
    label: 'Branches',
  },
  {
    from: 0.82,
    to: 1.01,
    color: '#a37bff',
    num: '04',
    total: '04',
    icon: '📋',
    title: 'Smart Prescription & Billing.',
    description:
      'Generate digital prescriptions, automate billing, and export patient records with a single click. HIPAA-ready.',
    label: 'Records',
  },
];

export default function OnboardingHeroPage() {
  return (
    <FrameSequenceHero
      frameCount={FRAME_COUNT}
      framePath={framePath}
      eagerCount={60}
      scrollHeight="600vh"
      brand={
        <>
          <span className="fsh-brand-dot" style={{ background: '#e93362', boxShadow: '0 0 8px #e93362' }} />
          HealthSync
        </>
      }
      navLinks={[
        { label: 'Overview', href: '#' },
        { label: 'Features', href: '#' },
        { label: 'Branches', href: '#' },
        { label: 'Support', href: '#' },
      ]}
      ctaLabel="Enter Gateway"
      ctaHref="/"
      title={
        <>
          <span className="fsh-title-dark">HealthSync</span>{' '}
          <span className="fsh-title-rainbow">CLMS</span>
        </>
      }
      subtitle="Scroll to explore your clinic management platform."
      steps={steps}
    />
  );
}
