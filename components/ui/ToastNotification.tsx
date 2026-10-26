'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto p-3.5 rounded-2xl shadow-xl border backdrop-blur-md flex items-start gap-3 ${
                isSuccess
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                  : isError
                  ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                  : isWarning
                  ? 'bg-amber-50/95 border-amber-200 text-amber-900'
                  : 'bg-blue-50/95 border-blue-200 text-blue-900'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {isError && <XCircle className="w-4 h-4 text-rose-600" />}
                {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                {!isSuccess && !isError && !isWarning && (
                  <Info className="w-4 h-4 text-blue-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold leading-tight">{toast.title}</h4>
                {toast.message && (
                  <p className="text-[11px] opacity-90 mt-0.5 leading-normal">
                    {toast.message}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ToastNotification;
