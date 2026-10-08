'use client';

import React, { useState } from 'react';
import { useClinic } from '@/context/ClinicContext';
import {
  BarChart3,
  Users,
  Clock,
  Pill,
  CheckCircle2,
  Printer,
  Calendar,
  Activity,
  ArrowUpRight
} from 'lucide-react';

export default function AnalyticsView() {
  const {
    patients,
    inventory,
    completedConsultations,
    reprintConsultation
  } = useClinic();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = [
    { label: 'Viral Fever & URI', value: 45, color: '#ef4444', count: 24 },
    { label: 'Gastric & Reflux', value: 25, color: '#f59e0b', count: 14 },
    { label: 'Allergies & Skin', value: 15, color: '#3b82f6', count: 8 },
    { label: 'Routine Vitals Check', value: 10, color: '#10b981', count: 5 },
    { label: 'Orthopedic & Joint', value: 5, color: '#8b5cf6', count: 3 }
  ];

  const totalPatientsToday = 54 + patients.length - 6;
  const completedCount = completedConsultations.length;

  return (
    <div className="space-y-6">
      {/* Analytics Header (Nexuma Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/70">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-xs font-display font-semibold text-slate-700 shadow-2xs mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Clinic Performance Analytics</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-700 font-bold">Live Stream</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight leading-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <span>Operational Analytics</span>
          </h1>
          <p className="text-xs font-sans text-slate-500 mt-1 max-w-xl leading-relaxed">
            Real-time outpatient throughput, clinical case patterns, and pharmacy fulfillment metrics
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-display font-semibold px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs self-start sm:self-auto">
          <Activity className="w-3.5 h-3.5 animate-pulse text-blue-600" />
          <span>Live OPD Day Stream</span>
        </div>
      </div>

      {/* KPI Cards Grid (Nexuma Metric Architecture) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="apple-glass rounded-[20px] p-5 sm:p-6 border border-slate-200/80 apple-card-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-500">
              Patients Today
            </span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-display font-bold text-blue-700">
              {totalPatientsToday}
            </span>
            <span className="text-xs font-display font-bold text-emerald-600 flex items-center">
              +12% <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <p className="text-[11px] font-sans text-slate-400 mt-1.5">vs yesterday average</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
        </div>

        {/* Metric 2 */}
        <div className="apple-glass rounded-[20px] p-5 sm:p-6 border border-slate-200/80 apple-card-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-500">
              Avg. Duration
            </span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-4xl font-display font-bold text-emerald-700">
              14<span className="text-xl font-display font-bold text-slate-600">m</span>
            </span>
            <span className="text-xs font-sans font-medium text-slate-500">/ patient</span>
          </div>
          <p className="text-[11px] font-sans text-slate-400 mt-1.5">Optimal target: &lt;15m</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        </div>

        {/* Metric 3 */}
        <div className="apple-glass rounded-[20px] p-5 sm:p-6 border border-slate-200/80 apple-card-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-500">
              Fulfilled Rx
            </span>
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-display font-bold text-purple-700">
              {48 + completedCount}
            </span>
            <span className="text-xs font-display font-semibold text-purple-600">Issued</span>
          </div>
          <p className="text-[11px] font-sans text-slate-400 mt-1.5">Digital Rx dispensed</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
        </div>

        {/* Metric 4 */}
        <div className="apple-glass rounded-[20px] p-5 sm:p-6 border border-slate-200/80 apple-card-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-500">
              Pharmacy Sync
            </span>
            <Pill className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-display font-bold text-sky-700">
              {inventory.reduce((acc, item) => acc + item.stock, 0)}
            </span>
            <span className="text-xs font-sans font-medium text-slate-500">Units</span>
          </div>
          <p className="text-[11px] font-sans text-slate-400 mt-1.5">Active inventory pool</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Doughnut Diagnostic Distribution (5 cols) */}
        <div className="lg:col-span-5 apple-glass rounded-[22px] p-6 border border-slate-200/80 apple-card-shadow space-y-4">
          <div className="text-center pb-3 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900 text-base tracking-tight">
              Consultation Diagnostic Breakdown
            </h3>
            <p className="text-xs font-sans text-slate-500 mt-0.5">Clinical case distribution today</p>
          </div>

          {/* SVG Circular Donut Chart */}
          <div className="relative w-48 h-48 mx-auto flex items-center justify-center my-4">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="13"
              />
              {/* Segment 1: Viral (45%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#ef4444"
                strokeWidth="13"
                strokeDasharray="107.4 238.7"
                strokeDashoffset="0"
                className="transition-all hover:stroke-[15]"
              />
              {/* Segment 2: Gastric (25%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="13"
                strokeDasharray="59.7 238.7"
                strokeDashoffset="-107.4"
                className="transition-all hover:stroke-[15]"
              />
              {/* Segment 3: Allergies (15%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="13"
                strokeDasharray="35.8 238.7"
                strokeDashoffset="-167.1"
                className="transition-all hover:stroke-[15]"
              />
              {/* Segment 4: Routine (10%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#10b981"
                strokeWidth="13"
                strokeDasharray="23.9 238.7"
                strokeDashoffset="-202.9"
                className="transition-all hover:stroke-[15]"
              />
              {/* Segment 5: Orthopedic (5%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="13"
                strokeDasharray="11.9 238.7"
                strokeDashoffset="-226.8"
                className="transition-all hover:stroke-[15]"
              />
            </svg>

            {/* Inner Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl font-display font-bold text-slate-900">100%</span>
              <span className="text-[10px] uppercase font-display font-bold text-slate-400">Cases</span>
            </div>
          </div>

          {/* Category breakdown rows */}
          <div className="space-y-2 pt-2">
            {categories.map((cat, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setActiveCategory(cat.label)}
                onMouseLeave={() => setActiveCategory(null)}
                className={`flex items-center justify-between p-2.5 rounded-xl transition-colors cursor-default ${
                  activeCategory === cat.label ? 'bg-slate-100 shadow-2xs' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-xs font-display font-semibold text-slate-700">
                    {cat.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-sans text-slate-400">{cat.count} pts</span>
                  <span className="text-xs font-display font-bold text-slate-900 w-9 text-right">
                    {cat.value}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Consultation Audit Log (7 cols) */}
        <div className="lg:col-span-7 apple-glass rounded-[22px] p-6 border border-slate-200/80 apple-card-shadow space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base tracking-tight">
                Completed Consultations History
              </h3>
              <p className="text-xs font-sans text-slate-500 mt-0.5">Recent prescriptions & records</p>
            </div>
            <span className="text-xs font-display font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
              {completedConsultations.length} Processed Today
            </span>
          </div>

          {completedConsultations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-sans">
              <p className="text-sm font-medium">No consultations completed yet today.</p>
              <p className="text-xs mt-1">Completed records will be listed here with reprint access.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedConsultations.map(record => (
                <div
                  key={record.id}
                  className="p-4 rounded-xl bg-white border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-slate-900 text-sm tracking-tight">
                        {record.patientName}
                      </span>
                      <span className="text-xs font-sans text-slate-500 font-medium">
                        ({record.patientAge} Yrs / {record.patientGender})
                      </span>
                      <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold border border-blue-100">
                        {record.id}
                      </span>
                    </div>
                    <p className="text-xs font-sans text-slate-600 mt-1 line-clamp-1 italic">
                      Rx: {record.diagnostics}
                    </p>
                    <p className="text-[11px] font-sans text-slate-400 mt-0.5">
                      {record.prescription.length} medicines prescribed • {record.date}
                    </p>
                  </div>

                  <button
                    onClick={() => reprintConsultation(record)}
                    className="self-end sm:self-center px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-700 text-xs font-display font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                    <span>Reprint Rx</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
