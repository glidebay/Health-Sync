import type { Variants } from 'framer-motion';

export const AVAILABLE_SLOTS = [
  { time: '09:00 AM', period: 'Morning' as const },
  { time: '09:30 AM', period: 'Morning' as const },
  { time: '10:00 AM', period: 'Morning' as const },
  { time: '10:30 AM', period: 'Morning' as const },
  { time: '11:00 AM', period: 'Morning' as const },
  { time: '11:30 AM', period: 'Morning' as const },
  { time: '02:00 PM', period: 'Afternoon' as const },
  { time: '02:30 PM', period: 'Afternoon' as const },
  { time: '03:00 PM', period: 'Afternoon' as const },
  { time: '03:30 PM', period: 'Afternoon' as const },
  { time: '04:00 PM', period: 'Afternoon' as const },
  { time: '05:00 PM', period: 'Evening' as const },
  { time: '05:30 PM', period: 'Evening' as const },
  { time: '06:00 PM', period: 'Evening' as const },
  { time: '06:30 PM', period: 'Evening' as const },
];

export const QUICK_SYMPTOMS = [
  'General Consultation',
  'Viral Fever & URI',
  'Cough & Throat Pain',
  'Headache & Migraine',
  'Gastric & Acidity',
  'BP & Sugar Checkup',
  'Joint & Body Pain',
  'Skin Rash / Allergy',
];

export const sidebarVariants: Variants = {
  hidden: { x: -280, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 26,
      stiffness: 240,
      staggerChildren: 0.04,
    },
  },
};

export const navItemVariants: Variants = {
  hidden: { x: -16, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', damping: 20, stiffness: 280 },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 22, stiffness: 260 },
  },
};

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', damping: 24, stiffness: 260 },
  },
};

export const gatewayContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

export const gatewayLogoVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 18,
      stiffness: 280,
    },
  },
};

export const gatewayTextVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 22,
      stiffness: 260,
    },
  },
};

export const gatewayButtonsVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 260,
    },
  },
};
