'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  ArrowRight,
} from 'lucide-react';

export type NotificationType = 'warning' | 'error' | 'info' | 'success';

export interface NotificationState {
  isOpen: boolean;
  type: NotificationType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationModalProps {
  notification: NotificationState | null;
  onClose: () => void;
}

export function NotificationModal({ notification, onClose }: NotificationModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notification?.isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification, onClose]);

  if (!notification || !notification.isOpen) return null;

  const { type, title, message, actionLabel, onAction } = notification;

  const themeConfig = {
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-50',
      iconBorder: 'border-amber-200',
      iconColor: 'text-amber-600',
      pillBg: 'bg-blue-50 border border-blue-100',
      pillText: 'text-[#2563EB]',
      badge: 'Action Required',
      primaryBtn: 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-blue-500/20',
    },
    error: {
      icon: AlertCircle,
      iconBg: 'bg-rose-50',
      iconBorder: 'border-rose-200',
      iconColor: 'text-rose-600',
      pillBg: 'bg-rose-50 border border-rose-100',
      pillText: 'text-rose-700',
      badge: 'Attention Needed',
      primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
    },
    success: {
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50',
      iconBorder: 'border-emerald-200',
      iconColor: 'text-emerald-600',
      pillBg: 'bg-emerald-50 border border-emerald-100',
      pillText: 'text-emerald-700',
      badge: 'Successful',
      primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
    },
    info: {
      icon: Info,
      iconBg: 'bg-blue-50',
      iconBorder: 'border-blue-200',
      iconColor: 'text-[#2563EB]',
      pillBg: 'bg-blue-50 border border-blue-100',
      pillText: 'text-[#2563EB]',
      badge: 'Notice',
      primaryBtn: 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-blue-500/20',
    },
  }[type || 'warning'];

  const IconComponent = themeConfig.icon;

  const handleActionClick = () => {
    if (onAction) {
      onAction();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 24, stiffness: 320 }}
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#ECEEF2] overflow-hidden z-10"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center">
            {/* Animated Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.08, type: 'spring', damping: 14, stiffness: 260 }}
              className={`w-14 h-14 rounded-2xl ${themeConfig.iconBg} border ${themeConfig.iconBorder} flex items-center justify-center mb-4 ${themeConfig.iconColor} shadow-xs`}
            >
              <IconComponent className="w-7 h-7 stroke-[2.2]" />
            </motion.div>

            {/* Badge pill */}
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full ${themeConfig.pillBg} ${themeConfig.pillText} mb-2.5`}
            >
              {themeConfig.badge}
            </span>

            {/* Title */}
            <h3 className="text-lg sm:text-xl font-bold text-[#16191E] mb-2 leading-tight">
              {title}
            </h3>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[#5E6470] leading-relaxed mb-6 max-w-sm">
              {message}
            </p>

            {/* Action Buttons with equal size */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              {actionLabel && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleActionClick}
                  className={`w-full sm:flex-1 h-11 px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md ${themeConfig.primaryBtn}`}
                >
                  <span className="truncate">{actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                </motion.button>
              )}

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className={`w-full ${actionLabel ? 'sm:flex-1' : ''} h-11 px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center transition cursor-pointer ${
                  actionLabel
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
                }`}
              >
                <span>{actionLabel ? 'Dismiss' : 'Understood'}</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default NotificationModal;
