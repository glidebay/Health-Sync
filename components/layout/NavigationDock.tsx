'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { NavSection } from '@/types';
import { NavItemConfig } from './SideMenu';

interface NavigationDockProps {
  activeSection: NavSection;
  isLoggedIn: boolean;
  navItems: NavItemConfig[];
  onNavClick: (section: NavSection, reqAuth: boolean) => void;
  requireDoctorPin?: boolean;
}

export function NavigationDock({
  activeSection,
  isLoggedIn,
  navItems,
  onNavClick,
  requireDoctorPin = true,
}: NavigationDockProps) {
  const getShortLabel = (id: NavSection) => {
    switch (id) {
      case 'dashboard':
        return 'Home';
      case 'assistant':
        return 'Desk';
      case 'queue':
        return 'Queue';
      case 'consult':
        return 'Consult';
      case 'inventory':
        return 'Stock';
      case 'analytics':
        return 'Stats';
      case 'settings':
        return 'Settings';
      default:
        return 'View';
    }
  };

  return (
    <motion.nav
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260 }}
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-[#ECEEF2] no-print shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-1 py-1.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const isLocked = item.reqAuth && !isLoggedIn && requireDoctorPin;

          return (
            <button
              key={item.id}
              onClick={() => onNavClick(item.id, item.reqAuth)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 sm:px-2 rounded-xl transition-all duration-200 cursor-pointer min-w-0 flex-1 ${
                isActive ? 'text-[#2563EB]' : 'text-[#8A909D]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mobileNavPill"
                  className="absolute -top-1.5 w-7 sm:w-8 h-1 bg-[#2563EB] rounded-full"
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'stroke-[2.2] scale-110' : 'stroke-[1.6]'
                  }`}
                />
                {isLocked && (
                  <Lock className="absolute -top-1 -right-1.5 w-2.5 h-2.5 text-[#8A909D]" />
                )}
              </div>
              <span
                className={`text-[9px] mt-0.5 leading-tight truncate max-w-full ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {getShortLabel(item.id)}
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}

export default NavigationDock;
