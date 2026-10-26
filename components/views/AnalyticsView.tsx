'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Clock,
  TrendingUp,
  MessageSquare,
  Activity,
  Pill,
} from 'lucide-react';
import { ChartLine } from '@/components/ui/chart-line';
import { RankBarChart, type RankBarItem } from '@/components/ui/rank-bars';

interface AnalyticsViewProps {
  totalPatientsCount: number;
}

export function AnalyticsView({ totalPatientsCount }: AnalyticsViewProps) {
  // Monthly Patient Volume (Walk-in vs WhatsApp Bookings)
  const patientVolumeData = [
    { month: 'Jan', walkins: 420, whatsapp: 180 },
    { month: 'Feb', walkins: 460, whatsapp: 230 },
    { month: 'Mar', walkins: 440, whatsapp: 280 },
    { month: 'Apr', walkins: 510, whatsapp: 340 },
    { month: 'May', walkins: 580, whatsapp: 410 },
    { month: 'Jun', walkins: 550, whatsapp: 430 },
    { month: 'Jul', walkins: 610, whatsapp: 490 },
    { month: 'Aug', walkins: 640, whatsapp: 530 },
    { month: 'Sep', walkins: 620, whatsapp: 570 },
    { month: 'Oct', walkins: 690, whatsapp: 640 },
    { month: 'Nov', walkins: 730, whatsapp: 710 },
    { month: 'Dec', walkins: 780, whatsapp: 790 },
  ];

  // Top Selling / Dispensed Medicines Leaderboard
  const topSellingMedicines: RankBarItem[] = [
    {
      label: 'Paracetamol 650mg',
      sub: 'Dolo-650 · Analgesic & Antipyretic',
      value: 1420,
      highlight: true,
    },
    {
      label: 'Amoxicillin + Clav 625mg',
      sub: 'Augmentin · Broad-Spectrum Antibiotic',
      value: 1180,
    },
    {
      label: 'Pantoprazole 40mg',
      sub: 'Pan-40 · Antacid & PPI Gastro',
      value: 940,
    },
    {
      label: 'Cetirizine 10mg',
      sub: 'Cetzine · Antihistamine & Allergy',
      value: 760,
    },
    {
      label: 'Metformin 500mg',
      sub: 'Glycomet · Glycemic Control',
      value: 680,
    },
    {
      label: 'Azithromycin 500mg',
      sub: 'Azee-500 · Macrolide Antibiotic',
      value: 520,
    },
    {
      label: 'Montelukast 10mg',
      sub: 'Montair · Respiratory Care',
      value: 410,
    },
  ];

  const casesData = [
    { label: 'Viral Fever & URI', pct: '45%', color: 'bg-[#2563EB]' },
    { label: 'Gastric & Reflux', pct: '25%', color: 'bg-[#3B82F6]' },
    { label: 'Allergies & Skin', pct: '15%', color: 'bg-[#60A5FA]' },
    { label: 'Routine Vitals', pct: '10%', color: 'bg-[#93C5FD]' },
    { label: 'Orthopedic / Joints', pct: '5%', color: 'bg-[#BFDBFE]' },
  ];

  return (
    <motion.section
      key="analytics"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 sm:space-y-6"
    >
      {/* 4-Stat KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5">
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-[#8A909D] uppercase tracking-wider">
              Today's Patients
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#16191E] block">
              {totalPatientsCount}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
              <span>↑ +12%</span>
              <span className="text-[#8A909D] font-normal">vs yesterday</span>
            </span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-[#8A909D] uppercase tracking-wider">
              Avg Consult Time
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#16191E] block">
              14m
            </span>
            <span className="text-[10px] text-[#8A909D] block mt-0.5">
              Target: &lt; 15 mins/opd
            </span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-[#8A909D] uppercase tracking-wider">
              WhatsApp Bookings
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#16191E] block">
              50.3%
            </span>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
              <span>↑ +28%</span>
              <span className="text-[#8A909D] font-normal">digital adoption</span>
            </span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECEEF2] shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-semibold text-[#8A909D] uppercase tracking-wider">
              Yearly Footfall
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#16191E] block">
              11,850
            </span>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
              <span>↑ +21.4%</span>
              <span className="text-[#8A909D] font-normal">annual growth</span>
            </span>
          </div>
        </motion.div>
      </div>

      {/* Main Interactive Line Chart */}
      <div className="w-full">
        <ChartLine
          title="Patient Footfall & Booking Channel Trends"
          description="Comparison of Walk-in Registrations vs WhatsApp Self-Service Appointments (2025 – 2026)"
          data={patientVolumeData}
          index="month"
          series={[
            { key: 'walkins', label: 'Walk-in Patients', color: '#2563EB' },
            { key: 'whatsapp', label: 'WhatsApp Bookings', color: '#10B981' },
          ]}
          valueFormat="number"
          total="sum"
          delta="auto"
          curve="smooth"
          fill="dots"
          strokeWidth={2.5}
          height={240}
          showTooltip={true}
          showLegend={true}
          icon={<TrendingUp className="w-4 h-4 text-[#2563EB]" />}
        />
      </div>

      {/* 2-Column Grid: Top Selling Medicines Leaderboard + Case Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Selling Medicines (RankBarChart) */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#16191E] tracking-tight">
                Top Selling & Dispensed Medicines
              </h3>
              <p className="text-xs text-[#8A909D] font-medium mt-0.5">
                Pharmacy dispensation leaderboard · Current monthly volume
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] flex-shrink-0 shadow-2xs">
              <Pill className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <RankBarChart
              unit=" strips"
              items={topSellingMedicines}
              highlightColor="#2563EB"
            />
          </div>
        </motion.div>

        {/* Case Breakdown Donut Chart */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm flex flex-col justify-between"
        >
          <div className="mb-5">
            <h3 className="text-sm sm:text-base font-bold text-[#16191E] tracking-tight">
              Consultation Case Breakdown
            </h3>
            <p className="text-xs text-[#8A909D] font-medium mt-0.5">
              Distribution of symptoms and clinical diagnostic categories
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 flex-1">
            <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#2563EB"
                  strokeWidth="14"
                  strokeDasharray="107.44 238.76"
                  strokeDashoffset="0"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth="14"
                  strokeDasharray="59.69 238.76"
                  strokeDashoffset="-107.44"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#60A5FA"
                  strokeWidth="14"
                  strokeDasharray="35.81 238.76"
                  strokeDashoffset="-167.13"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#93C5FD"
                  strokeWidth="14"
                  strokeDasharray="23.88 238.76"
                  strokeDashoffset="-202.94"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#BFDBFE"
                  strokeWidth="14"
                  strokeDasharray="11.94 238.76"
                  strokeDashoffset="-226.82"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base sm:text-lg font-bold text-[#16191E]">100%</span>
                <span className="text-[9px] text-[#8A909D] font-bold uppercase tracking-wider">Cases</span>
              </div>
            </div>

            <div className="space-y-2 text-xs font-medium w-full sm:w-auto">
              {casesData.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between sm:justify-start space-x-3"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                    <span className="text-[#16191E] font-medium">{item.label}</span>
                  </div>
                  <span className="text-[#8A909D] font-bold ml-6">{item.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

export default AnalyticsView;
