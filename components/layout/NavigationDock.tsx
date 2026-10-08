'use client';

import React from 'react';
import { useClinic } from '@/context/ClinicContext';
import {
  ClipboardList,
  Users,
  Stethoscope,
  Package,
  BarChart3,
  Lock
} from 'lucide-react';
import { TabType } from '@/types';

export default function NavigationDock() {
  const { activeTab, switchTab, isLoggedIn, patients } = useClinic();

  const waitingCount = patients.filter(p => p.status === 'Waiting').length;

  const navItems: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    doctorOnly: boolean;
  }[] = [
    { id: 'assistant', label: 'Assist', icon: ClipboardList, doctorOnly: false },
    { id: 'queue', label: 'Queue', icon: Users, badge: waitingCount, doctorOnly: true },
    { id: 'consult', label: 'Consult', icon: Stethoscope, doctorOnly: true },
    { id: 'inventory', label: 'Inventory', icon: Package, doctorOnly: true },
    { id: 'analytics', label: 'Stats', icon: BarChart3, doctorOnly: true }
  ];

  return (
    <div className="fixed bottom-3 inset-x-0 z-40 flex justify-center px-4 md:hidden no-print pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-1.5 p-2 rounded-full apple-glass shadow-2xl border border-slate-200/80 ring-1 ring-slate-900/5 max-w-md w-full justify-around backdrop-blur-2xl">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isLocked = item.doctorOnly && !isLoggedIn;

          return (
            <button
              key={item.id}
              onClick={() => switchTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-blue-600 font-bold bg-blue-50/90 shadow-2xs font-display'
                  : 'text-slate-500 hover:text-slate-800 font-medium font-display'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 px-1 min-w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-display font-extrabold flex items-center justify-center leading-none shadow-2xs">
                    {item.badge}
                  </span>
                )}
                {isLocked && (
                  <span className="absolute -bottom-1 -right-1.5 p-0.5 bg-slate-200/90 rounded-full">
                    <Lock className="w-2.5 h-2.5 text-slate-600" />
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 ${isActive ? 'font-bold text-blue-700' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
