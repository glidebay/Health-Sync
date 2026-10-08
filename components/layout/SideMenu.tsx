'use client';

import React, { useState } from 'react';
import { useClinic } from '@/context/ClinicContext';
import BrandLogo from '@/components/common/BrandLogo';
import {
  ClipboardList,
  Users,
  Stethoscope,
  Package,
  BarChart3,
  Lock,
  Unlock,
  ShieldCheck,
  Activity,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import { TabType } from '@/types';

interface NavItemConfig {
  id: TabType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  doctorOnly: boolean;
  getBadge?: (waitingCount: number, inventoryCount: number) => string | number | undefined;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'assistant',
    label: 'Assistant Desk',
    subtitle: 'Triage & walk-in check-in',
    icon: ClipboardList,
    doctorOnly: false
  },
  {
    id: 'queue',
    label: 'Patient Queue',
    subtitle: 'Live chamber worklist',
    icon: Users,
    doctorOnly: true,
    getBadge: (waitingCount) => (waitingCount > 0 ? waitingCount : undefined)
  },
  {
    id: 'consult',
    label: 'Doctor Chamber',
    subtitle: 'Clinical notes & Rx builder',
    icon: Stethoscope,
    doctorOnly: true
  },
  {
    id: 'inventory',
    label: 'Pharmacy Stock',
    subtitle: 'Live molecules & batches',
    icon: Package,
    doctorOnly: true
  },
  {
    id: 'analytics',
    label: 'Analytics & Audit',
    subtitle: 'Throughput & OPD metrics',
    icon: BarChart3,
    doctorOnly: true
  }
];

export default function SideMenu() {
  const {
    activeTab,
    switchTab,
    isLoggedIn,
    openAuthModal,
    logoutDoctor,
    replayLoading,
    patients,
    inventory
  } = useClinic();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const waitingCount = patients.filter(p => p.status === 'Waiting').length;
  const inventoryCount = inventory.length;

  const handleTabClick = (tabId: TabType) => {
    switchTab(tabId);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      {/* Top Branding & Workspace Heading */}
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <BrandLogo size={isCollapsed ? 'sm' : 'md'} theme="light" />
          </div>

          {/* Collapse Toggle for Desktop */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Close for Mobile drawer */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live CLMS Status Pill */}
        {!isCollapsed && (
          <div className="inline-flex items-center justify-between w-full px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-display font-semibold text-slate-800">
                CLMS Live Sync
              </span>
            </div>
            <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          </div>
        )}

        {/* Workspace Menu Section */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-2 pb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-slate-400">
                Clinical Workspace
              </span>
              <span className="text-[9px] font-mono text-slate-400 font-semibold">
                OPD
              </span>
            </div>
          )}

          <div className="space-y-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isLocked = item.doctorOnly && !isLoggedIn;
              const badge = item.getBadge ? item.getBadge(waitingCount, inventoryCount) : undefined;

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`group relative w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-200 cursor-pointer text-left ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 border border-transparent'
                  }`}
                >
                  {/* Left Active Pill Indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-blue-600" />
                  )}

                  <div
                    className={`p-2 rounded-xl shrink-0 transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-slate-100/70 text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-display font-semibold truncate">
                          {item.label}
                        </span>
                        {isLocked && (
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                        {badge !== undefined && (
                          <span
                            className={`text-[10px] font-display font-bold px-1.5 py-0.2 rounded-full tabular-nums shrink-0 ${
                              isActive
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-200/80 text-slate-700'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-sans text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar Footer: Tools & Role / Auth Profile */}
      <div className="pt-4 border-t border-slate-200/80 space-y-3">
        {/* ECG Splash Replay Button */}
        {!isCollapsed ? (
          <button
            onClick={replayLoading}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-display font-medium text-slate-500 hover:text-blue-600 hover:bg-white/80 border border-transparent hover:border-slate-200/70 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ECG Splash Screen</span>
            </div>
            <Sparkles className="w-3 h-3 text-sky-400" />
          </button>
        ) : (
          <button
            onClick={replayLoading}
            title="Replay ECG Splash Screen"
            className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Authentication Card (Doctor / Assistant) */}
        {isLoggedIn ? (
          <div
            className={`p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xs border border-white/10 ${
              isCollapsed ? 'flex flex-col items-center justify-center gap-2' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-sky-200 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-display font-bold truncate">Dr. Sunny</span>
                      <span className="text-[9px] bg-white/25 px-1 py-0.2 rounded font-mono font-bold">MD</span>
                    </div>
                    <p className="text-[10px] text-blue-100/80 font-sans truncate">Chamber Active</p>
                  </div>
                )}
              </div>

              <button
                onClick={logoutDoctor}
                title="Lock Doctor Session"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`p-3 rounded-2xl bg-slate-100/90 border border-slate-200/80 ${
              isCollapsed ? 'flex flex-col items-center justify-center' : ''
            }`}
          >
            {!isCollapsed ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-display font-semibold text-slate-600">
                    Assistant Mode
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-400">Reception</span>
                </div>
                <button
                  onClick={() => openAuthModal()}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-display font-semibold py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-98 transition-all cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Doctor PIN</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => openAuthModal()}
                title="Unlock Doctor Session"
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top App Bar (Visible on mobile screens) */}
      <div className="lg:hidden sticky top-0 z-30 w-full apple-glass border-b border-slate-200/70 px-4 h-14 flex items-center justify-between">
        <BrandLogo size="sm" theme="light" />
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Drawer Backdrop & Slide-over Menu */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full apple-glass p-5 shadow-2xl flex flex-col z-10 animate-fadeIn">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Left Side Menu */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen apple-glass border-r border-slate-200/80 p-5 transition-all duration-300 z-30 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
