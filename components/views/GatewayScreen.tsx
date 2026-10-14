'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HeartPulse,
  Stethoscope,
  Syringe,
  Pill,
  Thermometer,
  Activity,
  ClipboardList,
  Microscope,
  Dna,
  Bandage,
  FlaskConical,
  ShieldCheck,
  Tablets,
  BriefcaseMedical,
  TestTubes,
  Hospital,
  Ambulance,
  HeartHandshake,
  FileHeart,
  Brain,
  BadgePlus,
  Droplets,
  Plus,
  Cross,
  CircleDot,
} from 'lucide-react';
import {
  gatewayContainerVariants,
  gatewayLogoVariants,
  gatewayTextVariants,
  gatewayButtonsVariants,
} from '@/lib/constants';
import { useIsMobile } from '@/hooks/useIsMobile';

interface GatewayScreenProps {
  onSelectBookSlot: () => void;
  onSelectConsulting: () => void;
  waitingCount?: number;
  doctorName?: string;
  doctorSpecialty?: string;
}

// Clinic & Doctor Equipment Constellation
// On Desktop: Spreads elegantly from left side to center (left: 3% - 48%, top: 4% - 94%)
// On Mobile: Moves and spreads across the TOP (left: 4% - 94%, top: 2% - 32%) creating an elegant medical canopy
interface EquipmentItem {
  Icon: React.ElementType;
  top: string;
  left: string;
  size: number;
  mTop: string;
  mLeft: string;
  mSize: number;
  rotate: number;
  opacity: string;
  color: string;
  duration: number;
  delay: number;
}

const CLINIC_EQUIPMENT: EquipmentItem[] = [
  // --- TIER 1: UPPER CELESTIAL CANOPY ---
  {
    Icon: BriefcaseMedical,
    top: '6%',
    left: '4%',
    size: 34,
    mTop: '3%',
    mLeft: '5%',
    mSize: 22,
    rotate: -8,
    opacity: 'opacity-40',
    color: 'text-blue-600',
    duration: 6.2,
    delay: 0,
  },
  {
    Icon: Thermometer,
    top: '5%',
    left: '16%',
    size: 24,
    mTop: '4%',
    mLeft: '17%',
    mSize: 18,
    rotate: 22,
    opacity: 'opacity-30',
    color: 'text-slate-500',
    duration: 5.4,
    delay: 0.6,
  },
  {
    Icon: Pill,
    top: '12%',
    left: '10%',
    size: 20,
    mTop: '11%',
    mLeft: '10%',
    mSize: 15,
    rotate: -32,
    opacity: 'opacity-30',
    color: 'text-blue-400',
    duration: 6.8,
    delay: 1.1,
  },
  {
    Icon: Activity,
    top: '8%',
    left: '27%',
    size: 30,
    mTop: '3%',
    mLeft: '30%',
    mSize: 20,
    rotate: 0,
    opacity: 'opacity-30',
    color: 'text-blue-500',
    duration: 6.0,
    delay: 1.7,
  },
  {
    Icon: Hospital,
    top: '5%',
    left: '39%',
    size: 28,
    mTop: '4%',
    mLeft: '44%',
    mSize: 20,
    rotate: 6,
    opacity: 'opacity-25',
    color: 'text-indigo-400',
    duration: 7.2,
    delay: 0.4,
  },
  {
    Icon: Plus,
    top: '12%',
    left: '47%',
    size: 15,
    mTop: '11%',
    mLeft: '38%',
    mSize: 13,
    rotate: 0,
    opacity: 'opacity-30',
    color: 'text-blue-400',
    duration: 5.0,
    delay: 2.2,
  },

  // --- TIER 2: HIGH-MID DYNAMICS ---
  {
    Icon: Stethoscope,
    top: '20%',
    left: '3%',
    size: 38,
    mTop: '18%',
    mLeft: '5%',
    mSize: 24,
    rotate: -14,
    opacity: 'opacity-40',
    color: 'text-blue-600',
    duration: 6.5,
    delay: 0.3,
  },
  {
    Icon: FlaskConical,
    top: '19%',
    left: '18%',
    size: 26,
    mTop: '17%',
    mLeft: '18%',
    mSize: 18,
    rotate: 14,
    opacity: 'opacity-30',
    color: 'text-sky-500',
    duration: 7.0,
    delay: 1.4,
  },
  {
    Icon: Tablets,
    top: '22%',
    left: '31%',
    size: 26,
    mTop: '8%',
    mLeft: '36%',
    mSize: 16,
    rotate: -16,
    opacity: 'opacity-30',
    color: 'text-slate-500',
    duration: 6.3,
    delay: 0.8,
  },
  {
    Icon: ShieldCheck,
    top: '25%',
    left: '43%',
    size: 28,
    mTop: '25%',
    mLeft: '22%',
    mSize: 19,
    rotate: 8,
    opacity: 'opacity-30',
    color: 'text-blue-600',
    duration: 7.5,
    delay: 1.9,
  },
  {
    Icon: Dna,
    top: '30%',
    left: '12%',
    size: 30,
    mTop: '28%',
    mLeft: '6%',
    mSize: 20,
    rotate: 18,
    opacity: 'opacity-30',
    color: 'text-indigo-500',
    duration: 8.1,
    delay: 0.5,
  },
  {
    Icon: Syringe,
    top: '32%',
    left: '23%',
    size: 28,
    mTop: '20%',
    mLeft: '28%',
    mSize: 18,
    rotate: 42,
    opacity: 'opacity-35',
    color: 'text-blue-500',
    duration: 6.7,
    delay: 2.1,
  },
  {
    Icon: CircleDot,
    top: '29%',
    left: '36%',
    size: 14,
    mTop: '12%',
    mLeft: '24%',
    mSize: 12,
    rotate: 0,
    opacity: 'opacity-25',
    color: 'text-slate-400',
    duration: 5.6,
    delay: 1.2,
  },

  // --- TIER 3: MID TRANSITION ---
  {
    Icon: ClipboardList,
    top: '44%',
    left: '3%',
    size: 34,
    mTop: '3%',
    mLeft: '57%',
    mSize: 21,
    rotate: -6,
    opacity: 'opacity-40',
    color: 'text-blue-600',
    duration: 7.1,
    delay: 0.7,
  },
  {
    Icon: Bandage,
    top: '52%',
    left: '3%',
    size: 24,
    mTop: '10%',
    mLeft: '51%',
    mSize: 17,
    rotate: -25,
    opacity: 'opacity-30',
    color: 'text-slate-500',
    duration: 6.1,
    delay: 0.4,
  },
  {
    Icon: Droplets,
    top: '36%',
    left: '16%',
    size: 22,
    mTop: '18%',
    mLeft: '48%',
    mSize: 16,
    rotate: 0,
    opacity: 'opacity-30',
    color: 'text-sky-400',
    duration: 6.4,
    delay: 1.5,
  },
  {
    Icon: HeartPulse,
    top: '33%',
    left: '28%',
    size: 28,
    mTop: '4%',
    mLeft: '69%',
    mSize: 20,
    rotate: 10,
    opacity: 'opacity-30',
    color: 'text-blue-500',
    duration: 6.9,
    delay: 2.3,
  },
  {
    Icon: TestTubes,
    top: '33%',
    left: '41%',
    size: 26,
    mTop: '12%',
    mLeft: '63%',
    mSize: 18,
    rotate: -10,
    opacity: 'opacity-30',
    color: 'text-indigo-500',
    duration: 7.3,
    delay: 0.9,
  },
  {
    Icon: BadgePlus,
    top: '35%',
    left: '48%',
    size: 22,
    mTop: '19%',
    mLeft: '59%',
    mSize: 16,
    rotate: 0,
    opacity: 'opacity-25',
    color: 'text-blue-500',
    duration: 5.8,
    delay: 1.6,
  },
  {
    Icon: FileHeart,
    top: '64%',
    left: '22%',
    size: 26,
    mTop: '25%',
    mLeft: '76%',
    mSize: 19,
    rotate: 8,
    opacity: 'opacity-30',
    color: 'text-blue-600',
    duration: 7.6,
    delay: 1.8,
  },
  {
    Icon: Pill,
    top: '65%',
    left: '33%',
    size: 18,
    mTop: '14%',
    mLeft: '75%',
    mSize: 14,
    rotate: 28,
    opacity: 'opacity-25',
    color: 'text-slate-400',
    duration: 5.7,
    delay: 2.5,
  },

  // --- TIER 4: LOWER & LATERAL COMPOSITION ---
  {
    Icon: Microscope,
    top: '63%',
    left: '3%',
    size: 38,
    mTop: '4%',
    mLeft: '82%',
    mSize: 22,
    rotate: -10,
    opacity: 'opacity-40',
    color: 'text-blue-600',
    duration: 7.8,
    delay: 0.2,
  },
  {
    Icon: Syringe,
    top: '59%',
    left: '15%',
    size: 28,
    mTop: '11%',
    mLeft: '86%',
    mSize: 18,
    rotate: -45,
    opacity: 'opacity-30',
    color: 'text-blue-500',
    duration: 6.5,
    delay: 1.3,
  },
  {
    Icon: Brain,
    top: '58%',
    left: '29%',
    size: 28,
    mTop: '19%',
    mLeft: '72%',
    mSize: 19,
    rotate: 12,
    opacity: 'opacity-30',
    color: 'text-indigo-400',
    duration: 8.0,
    delay: 2.0,
  },
  {
    Icon: HeartHandshake,
    top: '61%',
    left: '41%',
    size: 28,
    mTop: '4%',
    mLeft: '93%',
    mSize: 20,
    rotate: 0,
    opacity: 'opacity-30',
    color: 'text-blue-600',
    duration: 7.4,
    delay: 1.0,
  },
  {
    Icon: Cross,
    top: '69%',
    left: '11%',
    size: 16,
    mTop: '20%',
    mLeft: '84%',
    mSize: 14,
    rotate: 0,
    opacity: 'opacity-25',
    color: 'text-blue-400',
    duration: 5.2,
    delay: 1.7,
  },
  {
    Icon: Thermometer,
    top: '68%',
    left: '21%',
    size: 24,
    mTop: '27%',
    mLeft: '89%',
    mSize: 18,
    rotate: -18,
    opacity: 'opacity-30',
    color: 'text-slate-500',
    duration: 6.2,
    delay: 0.5,
  },
  {
    Icon: Activity,
    top: '67%',
    left: '33%',
    size: 26,
    mTop: '26%',
    mLeft: '64%',
    mSize: 18,
    rotate: 0,
    opacity: 'opacity-30',
    color: 'text-blue-500',
    duration: 6.6,
    delay: 2.4,
  },
  {
    Icon: FlaskConical,
    top: '72%',
    left: '45%',
    size: 24,
    mTop: '17%',
    mLeft: '93%',
    mSize: 17,
    rotate: 16,
    opacity: 'opacity-25',
    color: 'text-sky-500',
    duration: 7.1,
    delay: 1.1,
  },

  // --- TIER 5: BASELINE & FLANK EXTENSIONS ---
  {
    Icon: Ambulance,
    top: '80%',
    left: '5%',
    size: 30,
    mTop: '32%',
    mLeft: '4%',
    mSize: 20,
    rotate: 4,
    opacity: 'opacity-35',
    color: 'text-blue-600',
    duration: 7.9,
    delay: 0.6,
  },
  {
    Icon: Stethoscope,
    top: '82%',
    left: '17%',
    size: 32,
    mTop: '32%',
    mLeft: '91%',
    mSize: 20,
    rotate: 18,
    opacity: 'opacity-35',
    color: 'text-blue-500',
    duration: 6.7,
    delay: 1.5,
  },
  {
    Icon: Tablets,
    top: '78%',
    left: '29%',
    size: 24,
    mTop: '23%',
    mLeft: '11%',
    mSize: 17,
    rotate: -14,
    opacity: 'opacity-30',
    color: 'text-slate-500',
    duration: 6.0,
    delay: 2.2,
  },
  {
    Icon: Dna,
    top: '83%',
    left: '39%',
    size: 26,
    mTop: '15%',
    mLeft: '41%',
    mSize: 17,
    rotate: -12,
    opacity: 'opacity-25',
    color: 'text-indigo-400',
    duration: 8.3,
    delay: 0.8,
  },
  {
    Icon: Pill,
    top: '88%',
    left: '9%',
    size: 22,
    mTop: '28%',
    mLeft: '17%',
    mSize: 14,
    rotate: 35,
    opacity: 'opacity-30',
    color: 'text-slate-400',
    duration: 5.5,
    delay: 1.9,
  },
  {
    Icon: ClipboardList,
    top: '91%',
    left: '23%',
    size: 28,
    mTop: '28%',
    mLeft: '82%',
    mSize: 18,
    rotate: 6,
    opacity: 'opacity-35',
    color: 'text-blue-600',
    duration: 7.5,
    delay: 0.3,
  },
  {
    Icon: HeartPulse,
    top: '89%',
    left: '35%',
    size: 24,
    mTop: '24%',
    mLeft: '34%',
    mSize: 17,
    rotate: -8,
    opacity: 'opacity-25',
    color: 'text-blue-400',
    duration: 6.4,
    delay: 1.8,
  },
  {
    Icon: CircleDot,
    top: '88%',
    left: '47%',
    size: 14,
    mTop: '22%',
    mLeft: '67%',
    mSize: 12,
    rotate: 0,
    opacity: 'opacity-20',
    color: 'text-slate-400',
    duration: 5.3,
    delay: 2.6,
  },
];

export function GatewayScreen({
  onSelectBookSlot,
  onSelectConsulting,
}: GatewayScreenProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeIsMobile = mounted && isMobile;

  return (
    <motion.div
      key="gateway-screen"
      variants={gatewayContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="min-h-screen bg-[#F8F9FB] flex flex-col justify-center items-center py-10 px-4 relative select-none overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Dynamic CSS rules for instant CSS media-query responsive equipment placement */}
      <style>{`
        .equipment-item {
          top: var(--top-mobile);
          left: var(--left-mobile);
        }
        .equipment-item svg {
          width: var(--size-mobile);
          height: var(--size-mobile);
        }
        @media (min-width: 768px) {
          .equipment-item {
            top: var(--top-desktop);
            left: var(--left-desktop);
          }
          .equipment-item svg {
            width: var(--size-desktop);
            height: var(--size-desktop);
          }
        }
      `}</style>

      {/* Background Clinic & Doctor Equipment SVG Constellation */}
      {/* Desktop: Spreads from left to center. Mobile: Spreads across the TOP */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0">
        {/* Soft atmospheric blue glow spots */}
        <div className="hidden md:block absolute -top-28 -left-28 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl" />
        <div className="hidden md:block absolute top-1/2 left-6 -translate-y-1/2 w-96 h-96 bg-sky-100/30 rounded-full blur-3xl" />
        <div className="hidden md:block absolute -bottom-24 left-1/6 w-96 h-96 bg-blue-50/50 rounded-full blur-2xl" />

        {/* Mobile atmospheric top canopy glow */}
        <div className="md:hidden absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-100/45 rounded-full blur-3xl" />
        <div className="md:hidden absolute top-16 -left-12 w-48 h-48 bg-sky-100/30 rounded-full blur-2xl" />
        <div className="md:hidden absolute top-16 -right-12 w-48 h-48 bg-indigo-50/40 rounded-full blur-2xl" />

        {/* Mobile Top Canopy Curves */}
        <svg
          className="block md:hidden absolute inset-0 w-full h-full pointer-events-none opacity-[0.16] stroke-blue-500"
          fill="none"
        >
          <path
            d="M 10 35 Q 120 70 240 30 T 420 55"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            d="M 15 95 Q 140 140 270 90 T 440 125"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            d="M 25 155 Q 160 200 290 150 T 450 185"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
        </svg>

        {/* Desktop Left-to-Center Curves */}
        <svg
          className="hidden md:block absolute inset-0 w-full h-full pointer-events-none opacity-[0.16] stroke-blue-500"
          fill="none"
        >
          <path
            d="M 20 60 Q 140 140 220 80 T 400 170"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            d="M 30 280 Q 160 250 260 310 T 430 380"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            d="M 40 520 Q 170 580 290 510 T 440 640"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <path
            d="M 60 760 Q 190 820 330 780 T 460 840"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
        </svg>

        {/* Subtle medical dot matrix watermark: Top on mobile, Left on desktop */}
        <div
          className="absolute opacity-[0.04] [background-size:24px_24px] inset-x-0 top-0 h-2/5 [mask-image:linear-gradient(to_bottom,black_45%,transparent_100%)] md:inset-y-0 md:left-0 md:w-3/5 md:[mask-image:linear-gradient(to_right,black_40%,transparent_100%)]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #2563EB 1px, transparent 1px)',
          }}
        />

        {/* Spread of Equipment SVG Elements with Smooth Floating Motion */}
        {CLINIC_EQUIPMENT.map((item, index) => {
          const ItemIcon = item.Icon;

          return (
            <div
              key={index}
              style={
                {
                  '--top-mobile': item.mTop,
                  '--left-mobile': item.mLeft,
                  '--size-mobile': `${item.mSize}px`,
                  '--top-desktop': item.top,
                  '--left-desktop': item.left,
                  '--size-desktop': `${item.size}px`,
                } as React.CSSProperties
              }
              className="equipment-item absolute pointer-events-none"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: item.rotate }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -10, 0],
                  rotate: [item.rotate - 3, item.rotate + 3, item.rotate - 3],
                }}
                transition={{
                  opacity: { duration: 0.7, delay: 0.04 * (index % 12) },
                  scale: { duration: 0.7, delay: 0.04 * (index % 12) },
                  y: {
                    duration: item.duration,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay: item.delay,
                  },
                  rotate: {
                    duration: item.duration * 1.2,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay: item.delay,
                  },
                }}
                className={`${item.opacity} ${item.color}`}
              >
                <ItemIcon className="stroke-[1.8]" />
              </motion.div>
            </div>
          );
        })}
      </div>

      <motion.div className="flex flex-col items-center justify-center z-10 max-w-md w-full text-center relative">
        {/* Soft protective radial veil to guarantee pristine text legibility on all viewports */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[460px] h-[340px] sm:h-[460px] bg-[#F8F9FB]/90 sm:bg-[#F8F9FB]/75 rounded-full blur-2xl pointer-events-none -z-10" />

        <motion.div
          variants={gatewayLogoVariants}
          whileHover={{ scale: 1.06, rotate: 4 }}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#2563EB] shadow-xs mb-4 cursor-pointer"
        >
          <HeartPulse className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.3]" />
        </motion.div>

        <motion.h1
          variants={gatewayTextVariants}
          className="text-3xl sm:text-4xl font-extrabold text-[#16191E] tracking-tight mb-2"
        >
          Health<span className="text-[#2563EB]">Sync</span>
        </motion.h1>

        <motion.p
          variants={gatewayTextVariants}
          className="text-xs sm:text-sm text-[#8A909D] font-medium max-w-sm mb-8 px-2"
        >
          Clinical Logistics & Real-Time Patient Flow Management System
        </motion.p>

        <motion.div
          variants={gatewayButtonsVariants}
          className="flex flex-row items-center justify-center gap-3 w-full max-w-xs"
        >
          <motion.button
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            type="button"
            onClick={onSelectBookSlot}
            className="flex-1 py-3 px-5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-sm font-semibold text-white shadow-xs hover:shadow-md cursor-pointer"
          >
            Book Slot
          </motion.button>
          <motion.button
            whileHover={{
              scale: 1.03,
              y: -2,
              borderColor: '#9CA3AF',
              backgroundColor: '#F9FAFB',
              boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.08)',
            }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            type="button"
            onClick={onSelectConsulting}
            className="flex-1 py-3 px-5 rounded-xl bg-white border border-gray-300 text-sm font-semibold text-[#16191E] shadow-xs cursor-pointer"
          >
            Consulting
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default GatewayScreen;
