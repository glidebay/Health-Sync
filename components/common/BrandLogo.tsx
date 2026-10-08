'use client';

import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark' | 'header';
  showSubtitle?: boolean;
}

export default function BrandLogo({
  size = 'md',
  theme = 'header',
  showSubtitle = false
}: BrandLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  const isLight = theme === 'light';
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Icon Badge */}
      <div
        className={`relative ${iconSizes[size]} rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 ${
          isLight
            ? 'bg-blue-600 shadow-md shadow-blue-500/25'
            : isDark
            ? 'bg-slate-900 border border-slate-800'
            : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-600/30 ring-1 ring-white/20'
        }`}
      >
        {/* ECG pulse waveform */}
        <svg
          className="w-3/4 h-3/4 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </div>

      {/* Brand Title */}
      <div className="flex flex-col leading-tight">
        <div className={`font-display font-bold tracking-tight ${textSizes[size]}`}>
          <span className={isLight ? 'text-slate-900' : 'text-white'}>Health</span>
          <span className="text-sky-400">Sync</span>
        </div>
        {showSubtitle && (
          <span className="text-[9px] font-display font-semibold tracking-widest uppercase text-blue-200/80 -mt-0.5">
            A PRODUCT OF GLIDEBAY
          </span>
        )}
      </div>
    </div>
  );
}
