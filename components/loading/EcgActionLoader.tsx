'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface EcgActionLoaderProps {
  isLoading?: boolean;
  text?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  overlay?: boolean;
  fullscreen?: boolean;
  transparent?: boolean;
  className?: string;
  badge?: boolean;
}

/**
 * EcgActionLoader
 * Clean, full-screen centered action loading indicator.
 * Exclusively displays the moving ECG heartbeat pulse animation in the viewport center
 * over a transparent backdrop, with all background boxes/capsules and text removed.
 */
export function EcgActionLoader({
  isLoading = true,
  text,
  showText = false,
  size = 'md',
  overlay = true,
  fullscreen = true,
  transparent = true,
  className = '',
  badge = false,
}: EcgActionLoaderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isLoading) return null;

  const dims = {
    sm: { width: 80, height: 40, strokeWidth: 4 },
    md: { width: 120, height: 60, strokeWidth: 5 },
    lg: { width: 160, height: 80, strokeWidth: 6 },
  }[size];

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center select-none ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {badge ? (
          <div className="relative rounded-2xl bg-white/95 backdrop-blur-md border border-blue-100 shadow-[0_12px_40px_rgba(37,99,235,0.18)] flex items-center justify-center px-5 py-3">
            <svg
              className="text-[#2563EB] animate-ecg-glow overflow-visible"
              style={{ width: dims.width, height: dims.height }}
              viewBox="0 0 160 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 40 H45 L55 22 L65 58 L75 10 L88 70 L98 32 L106 44 L114 40 H150"
                stroke="#2563EB"
                strokeWidth={dims.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-ecg-draw"
              />
            </svg>
          </div>
        ) : (
          <svg
            className="text-[#2563EB] animate-ecg-glow overflow-visible"
            style={{ width: dims.width, height: dims.height }}
            viewBox="0 0 160 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 40 H45 L55 22 L65 58 L75 10 L88 70 L98 32 L106 44 L114 40 H150"
              stroke="#2563EB"
              strokeWidth={dims.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-ecg-draw"
            />
          </svg>
        )}
      </div>

      {showText && text && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3.5 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-100 shadow-sm flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-ping flex-shrink-0" />
          <span className="text-xs font-semibold text-[#16191E] tracking-tight">{text}</span>
        </motion.div>
      )}
    </motion.div>
  );

  // If overlay is disabled, render inline directly
  if (!overlay) {
    return <AnimatePresence>{content}</AnimatePresence>;
  }

  // Full-screen overlay via React Portal directly onto document.body
  if (fullscreen) {
    if (!mounted || typeof document === 'undefined') return null;

    return createPortal(
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto select-none ${
            transparent
              ? 'bg-slate-900/20 backdrop-blur-[2.5px]'
              : 'bg-white/90 backdrop-blur-md'
          }`}
          role="status"
          aria-live="polite"
        >
          {content}
        </motion.div>
      </AnimatePresence>,
      document.body
    );
  }

  // Fallback scoped container overlay
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className={`absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] pointer-events-auto ${
          transparent
            ? 'bg-slate-900/10 backdrop-blur-[2px]'
            : 'bg-white'
        }`}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

export default EcgActionLoader;
