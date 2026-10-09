'use client';

import React, { useState } from 'react';
import { useClinic } from '@/context/ClinicContext';
import {
  Users,
  Clock,
  Stethoscope,
  ChevronRight,
  Printer,
  CheckCircle2,
  Calendar,
  Filter,
  Phone
} from 'lucide-react';

export default function QueueView() {
  const {
    patients,
    startConsultation,
    reprintConsultation,
    completedConsultations
  } = useClinic();

  const [filter, setFilter] = useState<'all' | 'waiting' | 'completed'>('all');

  const filteredPatients = patients.filter(p => {
    if (filter === 'waiting') return p.status === 'Waiting' || p.status === 'In Progress';
    if (filter === 'completed') return p.status === 'Completed';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Controls (Nexuma Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/70">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-xs font-display font-semibold text-slate-700 shadow-2xs mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Clinical Worklist</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-700 font-bold">Dr. Sunny MD</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight leading-tight">
            Consultation Queue
          </h1>
          <p className="text-xs font-sans text-slate-500 mt-1 max-w-xl leading-relaxed">
            Select a patient to initiate real-time clinical charting and prescription builder
          </p>
        </div>

        {/* Nexuma Filter Pills */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/80 self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-display transition-all ${
              filter === 'all'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            All ({patients.length})
          </button>
          <button
            onClick={() => setFilter('waiting')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-display transition-all ${
              filter === 'waiting'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Pending ({patients.filter(p => p.status !== 'Completed').length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-display transition-all ${
              filter === 'completed'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Done ({patients.filter(p => p.status === 'Completed').length})
          </button>
        </div>
      </div>

      {/* Patient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {filteredPatients.map(patient => {
          const isWaiting = patient.status === 'Waiting';
          const isInProgress = patient.status === 'In Progress';
          const isCompleted = patient.status === 'Completed';

          // Check if there is an existing completed record to reprint
          const pastRecord = completedConsultations.find(c => c.patientId === patient.id);

          return (
            <div
              key={patient.id}
              onClick={() => {
                if (!isCompleted) startConsultation(patient.id);
              }}
              className={`apple-glass rounded-[20px] p-5 sm:p-6 border transition-all duration-200 apple-card-shadow flex flex-col justify-between gap-5 cursor-pointer group ${
                isInProgress
                  ? 'border-blue-400/80 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : isCompleted
                  ? 'border-slate-200/80 bg-slate-50/40 cursor-default'
                  : 'border-slate-200/85 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-900/5'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100/90 flex flex-col items-center justify-center text-blue-900 shrink-0 shadow-2xs">
                    <span className="text-[10px] uppercase font-display font-bold text-blue-600 leading-none">Tk</span>
                    <span className="text-lg font-display font-bold leading-tight">{patient.tokenNumber}</span>
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-slate-900 text-lg tracking-tight group-hover:text-blue-700 transition-colors">
                      {patient.name}
                    </h3>
                    <p className="text-xs font-sans text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>{patient.age} Yrs</span>
                      <span className="text-slate-300">•</span>
                      <span>{patient.gender}</span>
                      {patient.phone && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {patient.phone}
                          </span>
                        </>
                      )}
                      <span className="text-slate-300">•</span>
                      <span>Slot: {patient.time}</span>
                    </p>
                  </div>
                </div>

                {/* Priority / Status pill */}
                <div>
                  {isInProgress ? (
                    <span className="px-3 py-1 rounded-full text-xs font-display font-bold bg-blue-600 text-white flex items-center gap-1.5 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      In Chamber
                    </span>
                  ) : isCompleted ? (
                    <span className="px-3 py-1 rounded-full text-xs font-display font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Completed
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-display font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 shadow-2xs">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Waiting
                    </span>
                  )}
                </div>
              </div>

              {/* Card Bottom: Action CTA */}
              <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 text-xs font-sans">
                <div className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Scheduled for Dr. Sunny</span>
                </div>

                {isCompleted ? (
                  pastRecord && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        reprintConsultation(pastRecord);
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-display font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                      <span>Print Rx Copy</span>
                    </button>
                  )
                ) : (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      startConsultation(patient.id);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white font-display font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>{isInProgress ? 'Resume Charting' : 'Begin Charting'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
