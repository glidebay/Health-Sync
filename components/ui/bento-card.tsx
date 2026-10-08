'use client';

import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Folder,
  Plus,
  ArrowUpRight,
  Search,
  BarChart3,
  Check,
  Settings,
  Info,
  Database,
  Mail,
  User
} from 'lucide-react';

interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  header: string;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    header: 'Project Overview',
    description: 'Daily summary of your team performance.',
  },
  {
    id: 'management',
    label: 'Management',
    icon: Users,
    header: 'Team Management',
    description: 'Manage roles and user permissions.',
    badge: '10',
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: MessageSquare,
    header: 'Communications',
    description: 'High-priority team discussions.',
    badge: '12',
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: Folder,
    header: 'System Assets',
    description: 'Shared documentation and media logs.',
  },
];

export default function BentoCard() {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const content = useMemo(() => {
    switch (activeTab.id) {
      case 'dashboard':
        return <OverviewDashboard />;
      case 'management':
        return <ManagementDashboard />;
      case 'threads':
        return <ThreadsDashboard />;
      case 'resources':
        return <ResourcesDashboard />;
      default:
        return null;
    }
  }, [activeTab.id]);

  return (
    <div className="flex items-center justify-center w-full antialiased">
      <div className="group relative w-full max-w-xl overflow-hidden rounded-3xl sm:rounded-4xl border border-slate-200/80 bg-white shadow-2xl shadow-blue-900/5 transition-all duration-500 hover:shadow-blue-900/10 hover:-translate-y-1 m-0">
        <div className="p-4 sm:p-6 space-y-1.5 z-10 relative">
          <h2 className="text-xs text-slate-400 uppercase font-display font-semibold tracking-wider">
            Project Dashboard
          </h2>
          <p className="text-lg sm:text-2xl text-slate-900 font-display font-semibold leading-snug max-w-[480px]">
            High-performance analytics and team collaboration tools in one place.
          </p>
        </div>

        <div className="relative w-full h-[260px] sm:h-[300px] overflow-hidden rounded-2xl sm:rounded-[2rem]">
          <div className="absolute top-16 left-16 w-full h-full bg-slate-100 rounded-3xl border border-slate-200/50 opacity-80" />

          <div className="absolute top-8 left-24 w-full h-full bg-white rounded-tl-3xl shadow-xl flex flex-col overflow-hidden ring-6 ring-slate-200/80">
            <div className="px-5 py-4 rounded-tl-3xl border-b border-slate-200/70 flex items-center relative backdrop-blur-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <div className="w-2 h-2 rounded-full bg-slate-300" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-display font-semibold">
                  Workspace
                </span>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-36 border-r border-slate-200/40 p-2 flex flex-col gap-1 pt-6 bg-slate-50/50">
                {TABS.map((tab) => {
                  const isActive = activeTab.id === tab.id;
                  const Icon = tab.icon;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab)}
                      className={`relative flex items-center gap-1.5 p-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'text-blue-700 bg-white shadow-xs border border-slate-200/80 font-bold font-display'
                          : 'text-slate-500 hover:text-slate-800 font-medium font-sans'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 w-[2px] h-4 rounded-full bg-blue-600" />
                      )}
                      <Icon className="w-3.5 h-3.5 shrink-0 relative z-10" />
                      <span className="truncate relative z-10">
                        {tab.label}
                      </span>
                      {tab.badge && (
                        <span
                          className={`ml-auto text-[8px] leading-none py-0.5 px-1 rounded-md tabular-nums transition-all relative z-10 ${
                            isActive
                              ? 'bg-blue-100 text-blue-700 border border-blue-200/50'
                              : 'bg-slate-100 text-slate-500 border border-transparent'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 bg-white p-5 pt-6 flex flex-col gap-4 overflow-hidden relative">
                <header className="flex flex-col gap-0.5">
                  <h3 className="text-xs font-semibold text-slate-900 tracking-tight line-clamp-1 uppercase opacity-60 font-display">
                    {activeTab.header}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-normal leading-tight line-clamp-1 font-sans">
                    {activeTab.description}
                  </p>
                </header>

                <div className="flex-1 animate-fadeIn">
                  {content}
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none z-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const OverviewDashboard = () => (
  <div className="flex flex-col gap-3 h-full font-sans">
    <div className="relative p-3.5 rounded-xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50 overflow-hidden shadow-2xs">
      <div className="flex flex-col gap-2 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-medium text-slate-500">
            Team Performance
          </span>
          <ArrowUpRight className="w-3 h-3 text-blue-600" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-display font-bold tracking-tight text-slate-900">
            94.2%
          </span>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-blue-600 rounded-full w-[94.2%]" />
          </div>
        </div>
        <span className="text-[9px] text-slate-400">
          Score for Search & Delivery campaigns
        </span>
      </div>
      <div className="absolute -right-2 -bottom-2 opacity-5 scale-150 rotate-12 pointer-events-none">
        <BarChart3 className="w-16 h-16 text-slate-900" />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <div className="p-3 rounded-xl border border-slate-200/60 bg-white/70 flex items-center justify-between shadow-2xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-display font-bold text-slate-900">1,070</span>
          <span className="text-[8px] text-slate-400 uppercase font-medium">
            Keywords
          </span>
        </div>
        <Search className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div className="p-3 rounded-xl border border-slate-200/60 bg-white/70 flex items-center justify-between shadow-2xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-display font-bold text-slate-900">2.3M</span>
          <span className="text-[8px] text-slate-400 uppercase font-medium">
            Credits
          </span>
        </div>
        <Info className="w-3.5 h-3.5 text-slate-400" />
      </div>
    </div>
  </div>
);

const ManagementDashboard = () => (
  <div className="flex flex-col h-full font-sans">
    <div className="rounded-xl border border-slate-200/60 overflow-hidden flex flex-col h-full bg-white/70 shadow-2xs">
      <div className="bg-slate-50/70 px-3 py-2 border-b border-slate-200/60 flex items-center justify-between">
        <span className="text-[9px] font-display font-semibold text-slate-500 uppercase tracking-wider">
          Active Users
        </span>
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-white border border-slate-200/60 shadow-2xs">
          <Search className="w-2.5 h-2.5 text-slate-400" />
          <span className="text-[8px] text-slate-500 font-medium">
            Search
          </span>
        </div>
      </div>
      <div className="p-1 flex flex-col gap-0.5">
        {[
          {
            name: 'Anthony Dionne',
            role: 'Pending admin approval',
            status: 'Waitlist',
            color: 'bg-amber-400',
          },
          {
            name: 'Nick Yahodin',
            role: 'Dealership group admin',
            status: 'Active',
            color: 'bg-emerald-400',
          },
          {
            name: 'Mujeeb Aimaq',
            role: 'Dealership group user',
            status: 'Active',
            color: 'bg-emerald-400',
          },
        ].map((user, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
          >
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center relative">
              <User className="w-2.5 h-2.5 text-slate-500" />
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${user.color}`}
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-display font-semibold text-slate-900 truncate">
                {user.name}
              </span>
              <span className="text-[8px] text-slate-400 truncate">
                {user.role}
              </span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Settings className="w-3 h-3 text-slate-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ThreadsDashboard = () => (
  <div className="flex flex-col gap-3 h-full font-sans">
    <div className="grid grid-cols-2 gap-3">
      {[
        {
          title: 'Create a Page',
          desc: 'Build your project base.',
          icon: Folder,
        },
        {
          title: 'Create a Task',
          desc: 'Organize with team.',
          icon: Check,
        },
      ].map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="p-3 rounded-xl border border-slate-200/60 bg-white/70 flex flex-col gap-2.5 relative overflow-hidden group shadow-2xs"
          >
            <div className="flex flex-col gap-0.5 z-10">
              <span className="text-[11px] font-display font-bold text-slate-900 leading-tight">
                {card.title}
              </span>
              <span className="text-[9px] text-slate-500 leading-tight">
                {card.desc}
              </span>
            </div>
            <button className="w-fit flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 text-white text-[8px] font-display font-semibold transition-transform active:scale-95 group-hover:bg-blue-600 z-10 cursor-pointer">
              <Plus className="w-2.5 h-2.5" />
              <span>Create</span>
            </button>
          </div>
        );
      })}
    </div>

    <div className="mt-auto p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-md bg-white border border-slate-200/60 shadow-2xs">
          <Info className="w-2.5 h-2.5 text-slate-500" />
        </div>
        <span className="text-[9px] text-slate-600 font-medium">
          Pin a new item
        </span>
      </div>
      <Plus className="w-3 h-3 text-slate-400" />
    </div>
  </div>
);

const ResourcesDashboard = () => (
  <div className="flex flex-col gap-3 h-full overflow-hidden font-sans">
    <div className="flex-1 rounded-xl border border-slate-200/60 flex flex-col bg-white/70 overflow-hidden shadow-2xs">
      <div className="bg-slate-50/70 px-3 py-2 border-b border-slate-200/60 flex items-center justify-between">
        <span className="text-[9px] font-display font-semibold text-slate-500 uppercase tracking-wider">
          Archives & Logs
        </span>
        <Database className="w-3 h-3 text-slate-400" />
      </div>
      <div className="flex-1 p-1 overflow-y-auto">
        {[
          {
            file: 'design_spec_v2.pdf',
            size: '2.4 MB',
            type: 'PDF',
            icon: Mail,
          },
          {
            file: 'q4_performance.xls',
            size: '1.1 MB',
            type: 'XLS',
            icon: BarChart3,
          },
          {
            file: 'branding_assets.zip',
            size: '48 MB',
            type: 'ZIP',
            icon: Folder,
          },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                <Icon className="w-2.5 h-2.5" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] font-display font-medium text-slate-800 truncate">
                  {item.file}
                </span>
                <span className="text-[8px] text-slate-400 tabular-nums uppercase">
                  {item.size} • {item.type}
                </span>
              </div>
              <ArrowUpRight className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
