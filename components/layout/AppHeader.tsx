'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PanelLeft, HeartPulse, Search, LogIn, Lock, ChevronDown, Building2, Check } from 'lucide-react';
import { NavSection, Patient, InventoryItem } from '@/types';
import { DbClinicLocation } from '@/types/database';
import { GlobalPatientSearch } from '@/components/common/GlobalPatientSearch';
import { GlobalSettingsSearch } from '@/components/common/GlobalSettingsSearch';
import { GlobalAnalyticsSearch } from '@/components/common/GlobalAnalyticsSearch';

interface AppHeaderProps {
  isMobile: boolean;
  activeSection: NavSection;
  activeSectionLabel: string;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isLoggedIn: boolean;
  doctorProfile: { name: string; title: string };
  onToggleSidebar: () => void;
  onBackToGateway: () => void;
  onOpenPinModal: () => void;
  onLogout: () => void;
  requireDoctorPin?: boolean;
  queue?: Patient[];
  onSelectConsult?: (patient: Patient) => void;
  inventory?: InventoryItem[];
  branchName?: string;
  branchCode?: string;
  clinicLocations?: DbClinicLocation[];
  currentLocation?: DbClinicLocation | null;
  onSelectLocation?: (loc: DbClinicLocation) => void;
  isAdmin?: boolean;
}

export function AppHeader({
  isMobile,
  activeSection,
  activeSectionLabel,
  searchQuery,
  setSearchQuery,
  isLoggedIn,
  doctorProfile,
  onToggleSidebar,
  onBackToGateway,
  onOpenPinModal,
  onLogout,
  requireDoctorPin = true,
  queue = [],
  onSelectConsult,
  inventory = [],
  branchName,
  branchCode,
  clinicLocations = [],
  currentLocation,
  onSelectLocation,
  isAdmin = false,
}: AppHeaderProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const isPharmacyStock = activeSection === 'inventory';
  const isSettings = activeSection === 'settings';
  const isAnalytics = activeSection === 'analytics';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        if (!isPharmacyStock) {
          e.preventDefault();
          setIsSearchExpanded(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`w-full bg-[#F8F9FB] flex items-center justify-between no-print relative z-40 ${isMobile ? 'px-4 py-3.5 border-b border-[#ECEEF2]' : 'px-5 lg:px-8 py-5'
        }`}
    >
      {isSearchExpanded && !isPharmacyStock ? (
        <div className="w-full flex items-center">
          {isSettings ? (
            <GlobalSettingsSearch
              isExpanded={true}
              onClose={() => setIsSearchExpanded(false)}
              placeholder="Search settings..."
              onSelectSetting={(key) => {
                setIsSearchExpanded(false);
                setSearchQuery(key);
              }}
            />
          ) : isAnalytics ? (
            <GlobalAnalyticsSearch
              isExpanded={true}
              onClose={() => setIsSearchExpanded(false)}
              placeholder="Search analytics & insights..."
              onSelectItem={(_id, title) => {
                setIsSearchExpanded(false);
                setSearchQuery(title);
              }}
            />
          ) : (
            <GlobalPatientSearch
              isExpanded={true}
              onClose={() => setIsSearchExpanded(false)}
              queue={queue}
              onSelectConsult={(patient) => {
                setIsSearchExpanded(false);
                onSelectConsult?.(patient);
              }}
              placeholder="Search patient by name, phone, age, gender (e.g. Menon, 90000, Female, 20-50)..."
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-3 flex-shrink-0 min-w-0">
            {!isMobile && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={onToggleSidebar}
                className="w-10 h-10 rounded-xl bg-white border border-[#ECEEF2] shadow-xs flex items-center justify-center text-gray-600 hover:text-[#2563EB] hover:border-blue-200 hover:bg-blue-50/40 transition cursor-pointer flex-shrink-0"
                title="Toggle sidebar (Ctrl+B)"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="w-4 h-4 stroke-[2]" />
              </motion.button>
            )}

            {isMobile ? (
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] flex-shrink-0">
                  <HeartPulse className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-sm font-bold text-[#16191E] whitespace-nowrap">
                  {activeSectionLabel}
                </span>
              </div>
            ) : (
              <div className="relative flex items-center space-x-2.5 flex-shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8A909D] whitespace-nowrap">
                  CLMS Worklist
                </span>
                {branchName && (
                  <div className="relative">
                    {isAdmin && clinicLocations && clinicLocations.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setIsBranchDropdownOpen((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-[#2563EB] border border-blue-100/90 shadow-2xs hover:bg-blue-100/80 transition cursor-pointer"
                        title="Click to switch clinic branch dashboard (Admin Doctor)"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse flex-shrink-0" />
                        <span className="truncate max-w-[160px] sm:max-w-[220px]">
                          {branchName} {branchCode ? `(${branchCode})` : ''}
                        </span>
                        <ChevronDown className={`w-3 h-3 text-blue-500 transition-transform duration-150 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    ) : (
                      <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100/90 text-slate-700 border border-slate-200/80 shadow-2xs select-none"
                        title="Branch Allocated Workspace"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="truncate max-w-[160px] sm:max-w-[220px]">
                          {branchName} {branchCode ? `(${branchCode})` : ''}
                        </span>
                      </div>
                    )}

                    {isAdmin && isBranchDropdownOpen && clinicLocations && clinicLocations.length > 0 && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsBranchDropdownOpen(false)}
                        />
                        <div className="absolute left-0 mt-1.5 w-68 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                          <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 text-blue-600" />
                              <span>Switch Branch</span>
                            </span>
                            <span className="text-blue-600 font-semibold">{clinicLocations.length} Locations</span>
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1">
                            {clinicLocations.map((loc) => {
                              const isCurrent = loc.id === currentLocation?.id || loc.branch_name === branchName;
                              return (
                                <button
                                  key={loc.id}
                                  type="button"
                                  onClick={() => {
                                    if (onSelectLocation) onSelectLocation(loc);
                                    setIsBranchDropdownOpen(false);
                                  }}
                                  className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-2 text-xs transition cursor-pointer ${
                                    isCurrent ? 'bg-blue-50/80 font-bold text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCurrent ? 'bg-blue-600' : 'bg-slate-300'}`} />
                                      <span className="truncate">{loc.branch_name}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 pl-3 truncate">
                                      {loc.branch_code || 'MAIN'} • {loc.address || 'Kochi'}
                                    </div>
                                  </div>
                                  {isCurrent && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`flex items-center min-w-0 ${isMobile ? 'space-x-1.5' : 'space-x-2.5 sm:space-x-3'}`}>
            {isMobile && !isPharmacyStock && (
              <button
                type="button"
                onClick={() => setIsSearchExpanded(true)}
                className="w-9 h-9 rounded-xl bg-white border border-[#ECEEF2] flex items-center justify-center text-[#2563EB] shadow-2xs hover:bg-blue-50 transition cursor-pointer flex-shrink-0"
                title={
                  isSettings
                    ? 'Search settings'
                    : isAnalytics
                    ? 'Search analytics'
                    : 'Search patients'
                }
              >
                <Search className="w-4 h-4 stroke-[2.2]" />
              </button>
            )}

            {!isMobile && !isPharmacyStock && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="flex-shrink-0"
              >
                <div
                  onClick={() => setIsSearchExpanded(true)}
                  className="relative flex items-center cursor-pointer w-44 sm:w-56 md:w-64 lg:w-72 xl:w-80 h-10 pl-10 pr-3.5 bg-[#ECEEF2] hover:bg-[#E6E8ED] border border-transparent rounded-xl text-xs text-gray-500 transition-all duration-200 group"
                  title={
                    isSettings
                      ? 'Search settings'
                      : isAnalytics
                      ? 'Search analytics'
                      : 'Search patients (press / or click)'
                  }
                >
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB] group-hover:scale-105 transition-transform">
                    <Search className="w-4 h-4 stroke-[2]" />
                  </span>
                  <span className="truncate text-gray-500 group-hover:text-gray-700">
                    {isSettings
                      ? 'Search settings...'
                      : isAnalytics
                      ? 'Search analytics & insights...'
                      : 'Search patient, phone, age...'}
                  </span>
                </div>
              </motion.div>
            )}

            {isLoggedIn || !requireDoctorPin ? (
              <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
                <span
                  className={`font-bold bg-[#EBECEF] text-[#16191E] rounded-xl border border-[#ECEEF2] flex items-center whitespace-nowrap ${isMobile ? 'h-9 text-[10px] px-2 max-w-[105px] truncate' : 'h-10 text-xs px-3 sm:px-3.5'
                    }`}
                >
                  <span className="hidden xl:inline">
                    {doctorProfile.name} ({doctorProfile.title})
                  </span>
                  <span className="xl:hidden truncate">{doctorProfile.name}</span>
                </span>
                {requireDoctorPin && (
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={onLogout}
                    className={`bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center transition duration-150 cursor-pointer whitespace-nowrap flex-shrink-0 group shadow-2xs ${
                      isMobile ? 'h-9 text-[11px] px-2.5 min-w-[74px] space-x-1' : 'h-10 text-xs px-3.5 min-w-[82px] space-x-1.5'
                    }`}
                    title="Lock Doctor Session"
                  >
                    <Lock className="w-3.5 h-3.5 text-blue-200 group-hover:text-white stroke-[2.2] flex-shrink-0" />
                    <span>Exit</span>
                  </motion.button>
                )}
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={onOpenPinModal}
                className={`bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center transition duration-150 cursor-pointer whitespace-nowrap flex-shrink-0 group shadow-2xs ${
                  isMobile ? 'h-9 text-[11px] px-2.5 min-w-[74px] space-x-1' : 'h-10 text-xs px-3.5 min-w-[82px] space-x-1.5'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 text-blue-200 group-hover:text-white stroke-[2.2] flex-shrink-0" />
                <span className="whitespace-nowrap">Sign In</span>
              </motion.button>
            )}
          </div>
        </>
      )}
    </motion.header>
  );
}

export default AppHeader;
