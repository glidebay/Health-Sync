'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartPulse, Lock, LucideIcon } from 'lucide-react';
import { NavSection } from '@/types';
import { navItemVariants } from '@/lib/constants';

export interface NavItemConfig {
  id: NavSection;
  label: string;
  icon: LucideIcon;
  reqAuth: boolean;
}

interface SideMenuProps {
  isOpen: boolean;
  activeSection: NavSection;
  isLoggedIn: boolean;
  doctorProfile: { name: string; title: string };
  navItems: NavItemConfig[];
  onNavClick: (section: NavSection, reqAuth: boolean) => void;
  onOpenPinModal: () => void;
  onLogout: () => void;
}

export function SideMenu({
  isOpen,
  activeSection,
  isLoggedIn,
  doctorProfile,
  navItems,
  onNavClick,
  onOpenPinModal,
  onLogout,
}: SideMenuProps) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.aside
          key="sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 256, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            type: 'spring',
            damping: 28,
            stiffness: 260,
            mass: 0.8,
          }}
          className="bg-white border-r border-[#ECEEF2] h-screen sticky top-0 no-print overflow-hidden flex-shrink-0 z-30"
        >
          <div className="w-64 min-w-[256px] py-8 px-6 flex flex-col justify-between h-full overflow-y-auto">
            <div className="flex flex-col space-y-9">
              <motion.div variants={navItemVariants} className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-3">
                  <motion.div
                    whileHover={{ scale: 1.08, rotate: 8 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-xs cursor-pointer flex-shrink-0"
                  >
                    <HeartPulse className="w-6 h-6 stroke-[2.2]" />
                  </motion.div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight text-[#16191E]">HealthSync</span>
                    <span className="text-[9px] font-bold tracking-wider text-[#8A909D] uppercase -mt-0.5">
                      CLMS Pavilion
                    </span>
                  </div>
                </div>
              </motion.div>

              <nav aria-label="Sidebar" className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  const isLocked = item.reqAuth && !isLoggedIn;

                  return (
                    <motion.div key={item.id} variants={navItemVariants}>
                      <button
                        onClick={() => onNavClick(item.id, item.reqAuth)}
                        className={`relative w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer text-left group ${
                          isActive
                            ? 'text-[#16191E] font-semibold'
                            : 'text-[#5E6470] hover:text-[#16191E] hover:bg-gray-50/80 font-medium'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeSidebarPill"
                            className="absolute inset-0 bg-[#EBECEF] rounded-xl"
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          />
                        )}
                        <div className="relative z-10 flex items-center space-x-3.5">
                          <Icon
                            className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                              isActive
                                ? 'text-[#2563EB] stroke-[2.2]'
                                : 'text-[#8A909D] group-hover:text-[#2563EB] stroke-[1.8]'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {isLocked && <Lock className="relative z-10 w-3.5 h-3.5 text-[#8A909D]" />}
                      </button>
                    </motion.div>
                  );
                })}
              </nav>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, type: 'spring', damping: 20 }}
              className="bg-[#F8F9FB] rounded-3xl p-5 pt-8 text-center border border-[#ECEEF2] flex flex-col items-center"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="relative w-16 h-16 mb-4 flex items-center justify-center"
              >
                <div className="w-14 h-12 bg-[#ECEEF2] rounded-2xl relative flex items-center justify-center shadow-inner mt-3">
                  <div className="w-3.5 h-4 bg-[#2563EB] rounded-full" />
                  <div className="absolute -top-5 w-8 h-8 border-4 border-blue-200 rounded-t-full bg-transparent" />
                </div>
              </motion.div>

              <p className="text-xs font-bold text-[#16191E] leading-relaxed max-w-[160px] mb-4">
                {isLoggedIn ? `Doctor Authenticated • ${doctorProfile.name}` : 'Doctor Security PIN Required for Triage & Rx'}
              </p>

              {isLoggedIn ? (
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onLogout}
                  className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition duration-150 shadow-sm cursor-pointer"
                >
                  Lock Session
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onOpenPinModal}
                  className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition duration-150 shadow-sm cursor-pointer"
                >
                  Authenticate PIN
                </motion.button>
              )}
            </motion.div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default SideMenu;
