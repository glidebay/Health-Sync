'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface AnalyticsViewProps {
  totalPatientsCount: number;
}

export function AnalyticsView({ totalPatientsCount }: AnalyticsViewProps) {
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
      className="space-y-4 sm:space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm text-center"
        >
          <span className="text-3xl sm:text-4xl font-extrabold text-[#16191E] block mb-1">
            {totalPatientsCount}
          </span>
          <span className="text-[11px] sm:text-xs font-semibold text-[#8A909D] uppercase tracking-wider">
            Total Patients Today
          </span>
        </motion.div>
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm text-center"
        >
          <span className="text-3xl sm:text-4xl font-extrabold text-[#16191E] block mb-1">14m</span>
          <span className="text-[11px] sm:text-xs font-semibold text-[#8A909D] uppercase tracking-wider">
            Avg Consultation Duration
          </span>
        </motion.div>
      </div>

      <motion.div
        whileHover={{ y: -2 }}
        className="bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm"
      >
        <h3 className="text-sm font-bold text-[#16191E] mb-6 text-center">
          Consultation Case Breakdown
        </h3>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0">
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
              <span className="text-[9px] text-[#8A909D] font-bold uppercase">Cases</span>
            </div>
          </div>

          <div className="space-y-2 text-xs font-medium w-full sm:w-auto">
            {casesData.map((item) => (
              <div key={item.label} className="flex items-center justify-between sm:justify-start space-x-2.5">
                <div className="flex items-center space-x-2.5">
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${item.color}`} />
                  <span className="text-[#16191E]">{item.label}</span>
                </div>
                <span className="text-[#8A909D] font-bold ml-4">{item.pct}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}

export default AnalyticsView;
