'use client';

import React from 'react';
import { useClinic } from '@/context/ClinicContext';
import BrandLogo from '@/components/common/BrandLogo';
import {
  Lock,
  Unlock,
  Activity,
  ShieldCheck,
  RefreshCw,
  ClipboardList,
  Users,
  Stethoscope,
  Package,
  BarChart3,
} from 'lucide-react';
import { TabType } from '@/types';

const tabIcons: Record<TabType, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  assistant: ClipboardList,
  queue: Users,
  consult: Stethoscope,
  inventory: Package,
  analytics: BarChart3,
};

export default function AppHeader() {
  const {
    role,
    isLoggedIn,
    activeTab,
    switchTab,
    openAuthModal,
    logoutDoctor,
    replayLoading,
    patients,
  } = useClinic();

  const waitingCount = (patients ?? []).filter(
    (p: { status: string }) => p.status === 'Waiting'
  ).length;

  const tabs: { id: TabType; label: string; doctorOnly: boolean }[] = [
    { id: 'assistant', label: 'Assistant',  doctorOnly: false },
    { id: 'queue',     label: 'Queue',       doctorOnly: true  },
    { id: 'consult',   label: 'Consult',     doctorOnly: true  },
    { id: 'inventory', label: 'Inventory',   doctorOnly: true  },
    { id: 'analytics', label: 'Analytics',   doctorOnly: true  },
  ];

  return (
    <aside
      className="hidden md:flex flex-col justify-between w-64 min-w-[256px] min-h-screen bg-white border-r border-[#ECEEF2] py-8 px-6 no-print sticky top-0 h-screen overflow-y-auto"
      style={{ fontFamily: 'var(--font-jakarta, "Plus Jakarta Sans", sans-serif)' }}
    >
      {/* Top section: Logo + Nav */}
      <div className="flex flex-col space-y-9">

        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-2">
          <BrandLogo size="md" theme="light" />
          {/* Live status dot */}
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Sidebar" className="space-y-1.5">
          {tabs.map(tab => {
            const Icon = tabIcons[tab.id];
            const isActive = activeTab === tab.id;
            const isLocked = tab.doctorOnly && !isLoggedIn;
            const badge = tab.id === 'queue' && waitingCount > 0 ? waitingCount : null;

            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#EBECEF] text-[#16191E]'
                    : 'text-[#5E6470] hover:text-[#16191E] hover:bg-gray-50'
                }`}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    isActive ? 'text-[#16191E]' : 'text-[#5E6470]'
                  }`}
                  style={{ strokeWidth: isActive ? 2.2 : 1.8 }}
                />
                <span className="flex-1 text-left">{tab.label}</span>

                {/* Waiting badge */}
                {badge && (
                  <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-extrabold min-w-4 h-4 flex items-center justify-center leading-none">
                    {badge}
                  </span>
                )}

                {/* Lock icon for doctor-only tabs when not logged in */}
                {isLocked && !badge && (
                  <Lock className="w-3.5 h-3.5 text-[#C8CCD2] flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: Doctor card / Auth */}
      <div className="flex flex-col gap-3">

        {/* Replay ECG Screen button */}
        <button
          onClick={replayLoading}
          title="View ECG Splash Screen"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#5E6470] hover:text-[#16191E] hover:bg-gray-50 transition-colors duration-150 w-full"
        >
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          <span>ECG Screen</span>
        </button>

        {/* Doctor session card or login button */}
        {isLoggedIn ? (
          <div className="bg-[#F8F9FB] rounded-3xl p-5 text-center border border-[#ECEEF2] flex flex-col items-center gap-3">
            {/* Doctor Avatar Badge */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>

            {/* Doctor info */}
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-xs font-bold text-[#16191E] leading-snug">Dr. Sunny</p>
              <span className="text-[10px] font-semibold text-[#8A909D] uppercase tracking-widest">MD · Active Session</span>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>Active CLMS</span>
            </div>

            {/* Lock / logout */}
            <button
              onClick={logoutDoctor}
              title="Lock Doctor Session"
              className="w-full py-2.5 px-4 bg-[#16191E] hover:bg-black text-white text-xs font-semibold rounded-xl transition duration-150 shadow-sm flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Session
            </button>
          </div>
        ) : (
          <div className="bg-[#F8F9FB] rounded-3xl p-5 text-center border border-[#ECEEF2] flex flex-col items-center gap-3">
            {/* Lock graphic (from Stitch design) */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="w-14 h-12 bg-[#E1E4E8] rounded-2xl relative flex items-center justify-center shadow-inner mt-3">
                <div className="w-3.5 h-4 bg-[#16191E] rounded-full" />
                <div className="absolute -top-5 w-8 h-8 border-4 border-[#C8CCD2] rounded-t-full bg-transparent" />
              </div>
            </div>

            <p className="text-xs font-bold text-[#16191E] leading-relaxed max-w-[150px]">
              Doctor PIN Required
            </p>

            <span className="text-[10px] text-[#8A909D] font-medium">
              Assistant Mode Active
            </span>

            <button
              onClick={() => openAuthModal()}
              className="w-full py-2.5 px-4 bg-[#16191E] hover:bg-black text-white text-xs font-semibold rounded-xl transition duration-150 shadow-sm flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              Doctor PIN
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
