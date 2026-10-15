'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartPulse, Lock, LogOut, ShieldCheck, CheckCircle2, LucideIcon } from 'lucide-react';
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
  onFullLogout?: () => void;
  requireDoctorPin?: boolean;
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
  onFullLogout,
  requireDoctorPin = true,
}: SideMenuProps) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.aside
          key="sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{
            type: 'spring',
            damping: 28,
            stiffness: 260,
            mass: 0.8,
          }}
          className="bg-white border-r border-[#ECEEF2] h-screen sticky top-0 no-print overflow-hidden flex-shrink-0 z-30"
        >
          <div className="w-[260px] min-w-[260px] py-6 px-4.5 flex flex-col justify-between h-full overflow-hidden">
            <div className="flex flex-col space-y-6">
              <motion.div variants={navItemVariants} className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-3.5">
                  <motion.div
                    whileHover={{ scale: 1.08, rotate: 6 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-xs cursor-pointer flex-shrink-0"
                  >
                    <HeartPulse className="w-6 h-6 stroke-[2.2]" />
                  </motion.div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight text-[#16191E]">HealthSync</span>
                    <span className="text-[10px] font-bold tracking-wider text-[#8A909D] uppercase -mt-0.5">
                      CLMS Pavilion
                    </span>
                  </div>
                </div>
              </motion.div>

              <nav aria-label="Sidebar" className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  const isLocked = item.reqAuth && !isLoggedIn && requireDoctorPin;

                  return (
                    <motion.div key={item.id} variants={navItemVariants}>
                      <button
                        onClick={() => onNavClick(item.id, item.reqAuth)}
                        className={`relative w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-colors duration-150 cursor-pointer text-left group ${
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
                            className={`w-5 h-5 transition-transform duration-150 group-hover:scale-110 ${
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

            <div className="flex flex-col space-y-2.5 mt-3 pt-3.5 border-t border-[#ECEEF2]/90 flex-shrink-0">
              <div className="bg-[#F8F9FB] rounded-2xl p-3 border border-[#ECEEF2] flex items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      !requireDoctorPin
                        ? 'bg-emerald-50 text-emerald-600'
                        : isLoggedIn
                        ? 'bg-blue-50 text-[#2563EB]'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {!requireDoctorPin ? (
                      <ShieldCheck className="w-4 h-4 stroke-[2]" />
                    ) : isLoggedIn ? (
                      <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                    ) : (
                      <Lock className="w-4 h-4 stroke-[2]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#16191E] leading-tight truncate">
                      {!requireDoctorPin
                        ? 'Open Access'
                        : isLoggedIn
                        ? 'Doctor Verified'
                        : 'Doctor Locked'}
                    </p>
                    <p className="text-[11px] text-[#8A909D] truncate font-medium">
                      {!requireDoctorPin
                        ? 'No PIN required'
                        : isLoggedIn
                        ? doctorProfile.name
                        : 'PIN required for Rx'}
                    </p>
                  </div>
                </div>

                {requireDoctorPin && (
                  isLoggedIn ? (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={onLogout}
                      className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-[#16191E] text-xs font-semibold rounded-lg border border-[#ECEEF2] transition cursor-pointer flex-shrink-0 shadow-2xs"
                      title="Lock Doctor Session"
                    >
                      Lock
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={onOpenPinModal}
                      className="px-2.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer flex-shrink-0"
                      title="Enter Doctor PIN"
                    >
                      Unlock
                    </motion.button>
                  )
                )}
              </div>

              {onFullLogout && (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onFullLogout}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#ECEEF2] bg-white hover:border-red-200 hover:bg-red-50/60 text-[#5E6470] hover:text-red-600 text-xs font-semibold flex items-center justify-center space-x-2 transition-all duration-150 shadow-2xs cursor-pointer"
                  title="Log Out of Clinic Session"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#8A909D] group-hover:text-red-600 stroke-[2] transition-colors" />
                  <span>Log Out</span>
                </motion.button>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default SideMenu;
