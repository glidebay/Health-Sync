'use client';

import React, { useState } from 'react';
import { useClinic } from '@/context/ClinicContext';
import {
  UserPlus,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Phone
} from 'lucide-react';

export default function AssistantView() {
  const {
    patients,
    registerPatient,
    reallocateSlot,
    updatePatientStatus,
    openAuthModal,
    isLoggedIn
  } = useClinic();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [formSuccess, setFormSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age) return;

    registerPatient(name.trim(), parseInt(age, 10), gender, phone.trim(), priority);
    setName('');
    setAge('');
    setPhone('');
    setPriority('Normal');
    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 3000);
  };

  const waitingCount = patients.filter(p => p.status === 'Waiting').length;
  const inProgressCount = patients.filter(p => p.status === 'In Progress').length;
  const completedCount = patients.filter(p => p.status === 'Completed').length;

  return (
    <div className="space-y-6">
      {/* Top Banner: Assistant Desk Overview (Nexuma Hero Style) */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-6 sm:p-8 md:p-9 text-white shadow-xl shadow-blue-900/10 border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            {/* Nexuma Overline Hero Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/12 backdrop-blur-md text-xs font-display font-semibold text-blue-100 mb-3 border border-white/15 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Reception Desk</span>
              <span className="text-white/40">•</span>
              <span>Live Queue Monitor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold tracking-tight text-white leading-tight">
              Patient Triage & Registration
            </h1>
            <p className="text-sm font-sans text-blue-100/80 mt-2 max-w-xl leading-relaxed">
              Coordinate patient walk-ins, manage slot allocations, and streamline flow for Dr. Sunny.
            </p>
          </div>

          {!isLoggedIn && (
            <button
              onClick={() => openAuthModal('queue')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-blue-900 font-display font-bold text-xs shadow-md shadow-black/10 hover:bg-blue-50 transition-all self-start md:self-auto active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Switch to Doctor View</span>
            </button>
          )}
        </div>

        {/* Quick Triage Counters (Nexuma Metrics Style) */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-7 pt-6 border-t border-white/15">
          <div className="bg-white/10 backdrop-blur-md rounded-[18px] p-3.5 sm:p-4 border border-white/15">
            <span className="text-[11px] font-display font-semibold text-blue-200/90 uppercase tracking-wider block">
              Waiting
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-display font-bold">{waitingCount}</span>
              <span className="text-xs text-blue-200 font-sans">patients</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-[18px] p-3.5 sm:p-4 border border-white/15">
            <span className="text-[11px] font-display font-semibold text-blue-200/90 uppercase tracking-wider block">
              In Chamber
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-display font-bold text-sky-300">{inProgressCount}</span>
              <span className="text-xs text-sky-200/80 font-sans">consulting</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-[18px] p-3.5 sm:p-4 border border-white/15">
            <span className="text-[11px] font-display font-semibold text-blue-200/90 uppercase tracking-wider block">
              Completed
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-display font-bold text-emerald-300">{completedCount}</span>
              <span className="text-xs text-emerald-200/80 font-sans">dispatched</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Queue Oversight (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Live Queue Oversight</span>
            </h2>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-display font-semibold text-slate-600">
              {patients.length} Registered Today
            </span>
          </div>

          <div className="space-y-3">
            {patients.map(patient => {
              const isWaiting = patient.status === 'Waiting';
              const isInProgress = patient.status === 'In Progress';
              const isCompleted = patient.status === 'Completed';

              return (
                <div
                  key={patient.id}
                  className={`apple-glass rounded-[20px] p-4 sm:p-5 border transition-all duration-200 apple-card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isInProgress
                      ? 'border-blue-400/80 ring-2 ring-blue-500/20 bg-blue-50/50'
                      : isCompleted
                      ? 'border-emerald-200/70 bg-emerald-50/20 opacity-85'
                      : 'border-slate-200/85 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Token pill */}
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100/90 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                      <span className="text-[10px] text-blue-600 font-display font-bold uppercase leading-none">Tk</span>
                      <span className="text-base font-display font-bold text-blue-900 leading-tight">
                        {patient.tokenNumber}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-slate-900 text-base tracking-tight">
                          {patient.name}
                        </span>
                        {patient.priority === 'Urgent' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            Urgent
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-sans text-slate-500 mt-1">
                        <span>{patient.age} Yrs</span>
                        <span className="text-slate-300">•</span>
                        <span>{patient.gender}</span>
                        {patient.phone && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {patient.phone}
                            </span>
                          </>
                        )}
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {patient.time}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isWaiting && (
                      <>
                        <button
                          onClick={() => reallocateSlot(patient.id)}
                          title="Push slot by 15 mins"
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-700 text-xs font-display font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
                        >
                          <RefreshCw className="w-3 h-3 text-slate-400" />
                          <span>Reallocate</span>
                        </button>
                        <button
                          onClick={() => updatePatientStatus(patient.id, 'In Progress')}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-display font-semibold shadow-xs transition-all active:scale-95"
                        >
                          Check In
                        </button>
                      </>
                    )}

                    {isInProgress && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-display font-bold border border-blue-200 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                        With Doctor
                      </span>
                    )}

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-display font-bold border border-emerald-200 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Register Walk-in Patient Form (5 cols) */}
        <div className="lg:col-span-5">
          <div className="apple-glass rounded-[24px] p-6 sm:p-7 border border-slate-200/85 apple-card-shadow sticky top-20">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shadow-2xs">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base tracking-tight">Register Walk-in Patient</h3>
                <p className="text-xs font-sans text-slate-500 mt-0.5">Add patient directly to Dr. Sunny&apos;s queue</p>
              </div>
            </div>

            {formSuccess && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-display font-semibold flex items-center gap-2 animate-fadeIn shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Patient successfully queued for consultation!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm font-sans">
              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Radhakrishnan Pillai"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-slate-900 text-sm transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. +91 98460 12345"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-slate-900 text-sm transition-all shadow-2xs"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    placeholder="e.g. 42"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-slate-900 text-sm transition-all shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 text-slate-900 text-sm transition-all shadow-2xs"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-slate-700 mb-1.5">
                  Clinical Priority
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setPriority('Normal')}
                    className={`py-2 px-3 rounded-xl text-xs font-display transition-all ${
                      priority === 'Normal'
                        ? 'bg-white text-blue-700 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('Urgent')}
                    className={`py-2 px-3 rounded-xl text-xs font-display transition-all ${
                      priority === 'Urgent'
                        ? 'bg-rose-500 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    Urgent Case
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-display font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-sky-200" />
                <span>Queue Patient for Dr. Sunny</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
