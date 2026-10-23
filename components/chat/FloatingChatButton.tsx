'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareText, X } from 'lucide-react';

interface FloatingChatButtonProps {
  isOpen: boolean;
  unreadCount?: number;
  onToggle: () => void;
}

export function FloatingChatButton({
  isOpen,
  unreadCount = 2,
  onToggle,
}: FloatingChatButtonProps) {
  return (
    <aside
      aria-label="Patient Chat & Slot Booking Assistant"
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 select-none flex flex-col items-end pointer-events-auto"
    >
      <div className="relative group">
        {/* Animated ambient pulse glow ring around circular component */}
        {!isOpen && (
          <span className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-blue-600/35 via-indigo-500/25 to-emerald-500/35 blur-md animate-pulse opacity-75 group-hover:opacity-100 transition duration-500 pointer-events-none" />
        )}

        {/* Circular background component */}
        <div className="relative rounded-full p-[2px] bg-gradient-to-br from-blue-500 via-indigo-600 to-emerald-500 shadow-xl shadow-blue-600/25">
          <motion.button
            type="button"
            onClick={onToggle}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.94 }}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${isOpen
              ? 'bg-[#16191E] text-white shadow-inner'
              : 'bg-gradient-to-tr from-[#1E40AF] via-[#2563EB] to-[#3B82F6] text-white'
            }`}
            aria-label={isOpen ? 'Close chat' : 'Open patient booking chat'}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="close-icon"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <X className="w-6 h-6 stroke-[2.5]" />
                </motion.div>
              ) : (
                <motion.div
                  key="chat-icon"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="relative flex items-center justify-center"
                >
                  <MessageSquareText className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Notification badge component with unread count */}
        {!isOpen && unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 z-10 flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-gradient-to-r from-rose-500 to-red-600 text-white text-[11px] font-black shadow-md border-2 border-white ring-2 ring-red-500/20"
          >
            {unreadCount}
          </motion.div>
        )}

        {/* Hover pill prompt */}
        {!isOpen && (
          <div className="hidden sm:block absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-xl bg-white text-[#16191E] text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-sm border border-slate-200/80">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>Patient Booking Chats</span>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

export default FloatingChatButton;
