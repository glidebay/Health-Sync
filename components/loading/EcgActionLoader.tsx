'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface EcgActionLoaderProps {
  isLoading?: boolean;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  overlay?: boolean;
  transparent?: boolean;
  className?: string;
  badge?: boolean;
}

/**
 * EcgActionLoader
 * Scoped, non-fullscreen action loading indicator featuring the signature HealthSync
 * moving ECG heartbeat pulse animation over a semi-transparent backdrop.
 */
export function EcgActionLoader({
  isLoading = true,
  text,
  size = 'md',
  overlay = true,
  transparent = true,
  className = '',
  badge = true,
}: EcgActionLoaderProps) {
  if (!isLoading) return null;

  const dims = {
    sm: { width: 56, height: 28, strokeWidth: 3.5, ring: 'w-12 h-12', padding: 'px-3 py-1.5' },
    md: { width: 84, height: 42, strokeWidth: 4.5, ring: 'w-16 h-16', padding: 'px-4 py-2.5' },
    lg: { width: 120, height: 60, strokeWidth: 5, ring: 'w-24 h-24', padding: 'px-6 py-4' },
  }[size];

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center p-3 text-center select-none ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Soft pulsing heartbeat ring */}
        <div
          className={`absolute rounded-full border border-blue-400/30 animate-pulse-ring pointer-events-none ${dims.ring}`}
        />

        {/* Translucent glass capsule */}
        {badge ? (
          <div
            className={`relative rounded-2xl bg-white/95 backdrop-blur-md border border-blue-100 shadow-[0_8px_30px_rgba(37,99,235,0.12)] flex items-center justify-center ${dims.padding}`}
          >
            <svg
              className="text-[#2563EB] animate-ecg-glow overflow-visible"
              style={{ width: dims.width, height: dims.height }}
              viewBox="0 0 160 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Ghost track */}
              <path
                d="M10 40 H45 L55 22 L65 58 L75 10 L88 70 L98 32 L106 44 L114 40 H150"
                stroke="rgba(37, 99, 235, 0.18)"
                strokeWidth={dims.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Animated pulsating blue heartbeat trace */}
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
              stroke="rgba(37, 99, 235, 0.18)"
              strokeWidth={dims.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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

      {text && (
        <motion.p
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2.5 text-xs font-semibold text-[#16191E] flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-ping flex-shrink-0" />
          <span>{text}</span>
        </motion.p>
      )}
    </motion.div>
  );

  if (!overlay) {
    return <AnimatePresence>{content}</AnimatePresence>;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className={`absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] pointer-events-auto ${
          transparent
            ? 'bg-white/75 backdrop-blur-[2.5px]'
            : 'bg-white'
        }`}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

export default EcgActionLoader;

