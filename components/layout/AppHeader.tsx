'use client';

import React from 'react';
import { useClinic } from '@/context/ClinicContext';
import BrandLogo from '@/components/common/BrandLogo';
import { Lock, Unlock, Activity, ShieldCheck, RefreshCw } from 'lucide-react';
import { TabType } from '@/types';

export default function AppHeader() {
  const {
    role,
    isLoggedIn,
    activeTab,
    switchTab,
    openAuthModal,
    logoutDoctor,
    replayLoading
  } = useClinic();

  const tabs: { id: TabType; label: string; icon: string; doctorOnly: boolean }[] = [
    { id: 'assistant', label: 'Assistant', icon: '📋', doctorOnly: false },
    { id: 'queue', label: 'Queue', icon: '👥', doctorOnly: true },
    { id: 'consult', label: 'Consult', icon: '🩺', doctorOnly: true },
    { id: 'inventory', label: 'Inventory', icon: '📦', doctorOnly: true },
    { id: 'analytics', label: 'Analytics', icon: '📊', doctorOnly: true }
  ];

  return (
    <header className="sticky top-0 z-40 w-full apple-glass border-b border-slate-200/70 no-print transition-all backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand & Live ECG Heartbeat  */}
        <div className="flex items-center gap-3">
          <BrandLogo size="md" theme="light" />
          
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-slate-700 text-[11px] font-display font-semibold tracking-tight shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Activity className="w-3 h-3 text-blue-600 animate-pulse" />
            <span className="text-slate-800">Active CLMS</span>
          </div>
        </div>

        {/* Desktop Segmented Navigation (Nexuma Pill Style) */}
        <nav className="hidden md:flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/80 shadow-inner">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const isLocked = tab.doctorOnly && !isLoggedIn;

            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`relative px-4 py-1.5 rounded-full text-xs font-display transition-all duration-200 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs font-bold tracking-tight scale-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
                {isLocked && (
                  <Lock className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Replay ECG + Role / Auth state */}
        <div className="flex items-center gap-2.5">
          {/* Replay ECG button */}
          <button
            onClick={replayLoading}
            title="View ECG Splash Screen"
            className="hidden lg:flex items-center gap-1.5 text-xs font-display font-medium text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-full hover:bg-slate-100 border border-transparent hover:border-slate-200/60 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>ECG Screen</span>
          </button>

          {/* User Role Card */}
          {isLoggedIn ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200/80">
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-xs font-display font-semibold shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-200" />
                <span>Dr. Sunny</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">MD</span>
              </div>
              <button
                onClick={logoutDoctor}
                title="Lock Doctor Session"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200/80">
              <span className="hidden sm:inline-block text-xs font-display font-medium text-slate-500">
                Assistant Mode
              </span>
              <button
                onClick={() => openAuthModal()}
                className="flex items-center gap-1.5 text-xs font-display font-semibold px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95 transition-all"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Doctor PIN</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
