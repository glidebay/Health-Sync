'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PanelLeft, HeartPulse, LogOut, Search, LogIn, Lock } from 'lucide-react';
import { NavSection } from '@/types';

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
}

export function AppHeader({
  isMobile,
  activeSectionLabel,
  searchQuery,
  setSearchQuery,
  isLoggedIn,
  doctorProfile,
  onToggleSidebar,
  onBackToGateway,
  onOpenPinModal,
  onLogout,
}: AppHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`w-full bg-[#F8F9FB] flex items-center justify-between no-print ${
        isMobile ? 'px-4 py-3.5 border-b border-[#ECEEF2]' : 'px-5 lg:px-8 py-5'
      }`}
    >
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
          <div className="flex items-center space-x-2 flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8A909D] whitespace-nowrap">
              CLMS Worklist
            </span>
            <span className="text-xs text-[#8A909D]">•</span>
            <span className="text-xs font-bold text-[#16191E] whitespace-nowrap">
              {activeSectionLabel}
            </span>
          </div>
        )}
      </div>

      <div className={`flex items-center min-w-0 ${isMobile ? 'space-x-1.5' : 'space-x-2.5 sm:space-x-3'}`}>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={onBackToGateway}
          className={`rounded-xl bg-white border border-[#ECEEF2] hover:border-red-200 font-semibold text-[#5E6470] hover:text-red-600 flex items-center transition cursor-pointer shadow-2xs group flex-shrink-0 whitespace-nowrap ${
            isMobile ? 'h-9 px-2.5 text-[11px] space-x-1' : 'h-10 px-3.5 sm:px-4 text-xs space-x-2'
          }`}
          title="Log Out to Gateway"
        >
          <LogOut className="w-3.5 h-3.5 text-[#8A909D] group-hover:text-red-600 stroke-[2] transition-colors flex-shrink-0" />
          <span className="whitespace-nowrap">Log Out</span>
        </motion.button>

        {!isMobile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="relative w-36 sm:w-44 md:w-48 lg:w-56 xl:w-64 flex-shrink-0"
          >
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#2563EB]">
              <Search className="w-4 h-4 stroke-[2]" />
            </span>
            <input
              type="text"
              placeholder="search patient or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-[#ECEEF2] border-0 rounded-xl text-xs placeholder-gray-400 text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300 transition-shadow duration-200"
            />
          </motion.div>
        )}

        {isLoggedIn ? (
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            <span
              className={`font-bold bg-[#EBECEF] text-[#16191E] rounded-xl border border-[#ECEEF2] flex items-center whitespace-nowrap ${
                isMobile ? 'h-9 text-[10px] px-2 max-w-[105px] truncate' : 'h-10 text-xs px-3 sm:px-3.5'
              }`}
            >
              <span className="hidden xl:inline">
                {doctorProfile.name} ({doctorProfile.title})
              </span>
              <span className="xl:hidden truncate">{doctorProfile.name}</span>
            </span>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onLogout}
              className={`bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center transition duration-150 cursor-pointer whitespace-nowrap flex-shrink-0 group ${
                isMobile ? 'h-9 text-[11px] px-2.5 space-x-1' : 'h-10 text-xs px-3.5 space-x-1.5'
              }`}
              title="Lock Doctor Session"
            >
              <Lock className="w-3.5 h-3.5 text-blue-200 group-hover:text-white stroke-[2.2] flex-shrink-0" />
              <span>Exit</span>
            </motion.button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onOpenPinModal}
            className={`bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center transition duration-150 shadow-sm cursor-pointer whitespace-nowrap flex-shrink-0 ${
              isMobile ? 'h-9 text-[11px] px-2.5 space-x-1' : 'h-10 text-xs px-4 space-x-2'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-200 stroke-[2] flex-shrink-0" />
            <span className="whitespace-nowrap">Sign In</span>
          </motion.button>
        )}
      </div>
    </motion.header>
  );
}

export default AppHeader;
