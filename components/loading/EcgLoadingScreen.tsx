'use client';

import React, { useEffect, useState } from 'react';
import { useClinic } from '@/context/ClinicContext';

export default function EcgLoadingScreen() {
  const { isLoading, dismissLoading } = useClinic();
  const [dots, setDots] = useState(1);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => (prev % 3) + 1);
    }, 450);

    return () => clearInterval(dotInterval);
  }, []);

  if (!isLoading) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-700 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(180deg, #102a71 0%, #173896 45%, #1b2668 100%)'
      }}
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-sky-400/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full">
        {/* ECG Glowing Circle Badge */}
        <div className="relative mb-8 w-44 h-44 flex items-center justify-center">
          {/* Subtle outer pulse aura */}
          <div className="absolute inset-0 rounded-full border border-sky-400/30 animate-pulse-ring" />
          
          {/* Circular ring container */}
          <div className="relative w-40 h-40 rounded-full bg-blue-900/40 backdrop-blur-md border border-white/10 shadow-[0_0_50px_rgba(56,189,248,0.25)] flex items-center justify-center overflow-hidden">
            
            {/* Spinning decorative cyan arc */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400/70 border-l-sky-400/40 animate-spin [animation-duration:8s]" />

            {/* Glowing heartbeat line SVG */}
            <svg
              className="w-32 h-20 text-sky-400 animate-ecg-glow"
              viewBox="0 0 160 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background faint guide line */}
              <path
                d="M10 40 H45 L55 22 L65 58 L75 10 L88 70 L98 32 L106 44 L114 40 H150"
                stroke="rgba(56, 189, 248, 0.2)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Animated active wave line */}
              <path
                d="M10 40 H45 L55 22 L65 58 L75 10 L88 70 L98 32 L106 44 L114 40 H150"
                stroke="#38bdf8"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-ecg-draw"
              />
            </svg>

          </div>
        </div>

        {/* Brand Title: HealthSync */}
        <div className="mb-3">
          <h1 className="text-4xl font-display font-extrabold tracking-tight text-white flex items-center justify-center">
            Health<span className="text-sky-400 font-display font-extrabold ml-0.5">Sync</span>
          </h1>
        </div>

        {/* Brand Subtitle: A PRODUCT OF GLIDEBAY */}
        <div className="w-full flex items-center justify-center gap-3 mb-10 opacity-90">
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-blue-300/40" />
          <span className="text-[11px] font-display font-bold tracking-[0.22em] text-blue-200/90 uppercase">
            A PRODUCT OF <span className="text-white font-display font-extrabold">GLIDEBAY</span>
          </span>
          <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-blue-300/40" />
        </div>

        {/* Animated Three Dots */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              dots >= 1 ? 'bg-sky-400 shadow-[0_0_10px_#38bdf8] scale-110' : 'bg-blue-400/30'
            }`}
          />
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              dots >= 2 ? 'bg-sky-400 shadow-[0_0_10px_#38bdf8] scale-110' : 'bg-blue-400/30'
            }`}
          />
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              dots >= 3 ? 'bg-sky-400 shadow-[0_0_10px_#38bdf8] scale-110' : 'bg-blue-400/30'
            }`}
          />
        </div>

        {/* Status text */}
        <p className="text-[11px] font-display font-semibold tracking-[0.25em] text-blue-200/75 uppercase mb-6">
          INITIALIZING SYSTEM...
        </p>

        {/* Quick skip button */}
        <button
          onClick={() => {
            setFading(true);
            setTimeout(dismissLoading, 300);
          }}
          className="text-xs font-display text-blue-200/60 hover:text-white px-4 py-1.5 rounded-full border border-white/10 hover:border-white/30 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
        >
          Skip Intro →
        </button>
      </div>
    </div>
  );
}
