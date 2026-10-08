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
        background: '#ffffff'
      }}
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-white/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full">
        {/* ECG Glowing Circle Badge */}
        <div className="relative mb-8 w-44 h-44 flex items-center justify-center">
          {/* Subtle outer pulse aura */}
          <div className="absolute inset-0 rounded-full border animate-pulse-ring" style={{ borderColor: 'rgba(37,99,235,0.3)' }} />
          
          {/* Circular ring container */}
          <div className="relative w-40 h-40 rounded-full bg-white backdrop-blur-md border shadow-[0_0_50px_rgba(37,99,235,0.15)] flex items-center justify-center overflow-hidden" style={{ borderColor: 'rgba(37,99,235,0.12)' }}>
            
            {/* Spinning decorative cyan arc */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin [animation-duration:8s]" style={{ borderTopColor: 'rgba(37,99,235,0.7)', borderLeftColor: 'rgba(37,99,235,0.4)' }} />

            {/* Glowing heartbeat line SVG */}
            <svg
              className="w-32 h-20 text-black animate-ecg-glow"
              viewBox="0 0 160 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background faint guide line */}
              <path
                d="M10 40 H45 L55 22 L65 58 L75 10 L88 70 L98 32 L106 44 L114 40 H150"
                stroke="rgba(37, 99, 235, 0.2)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Animated active wave line */}
              <path
                d="M10 40 H45 L55 22 L65 58 L75 10 L88 70 L98 32 L106 44 L114 40 H150"
                stroke="#2563EB"
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
          <h1 className="text-4xl font-display font-extrabold tracking-tight flex items-center justify-center" style={{ color: '#2563EB' }}>
            Health<span className="font-display font-extrabold ml-0.5" style={{ color: '#93b4f5' }}>Sync</span>
          </h1>
        </div>

        {/* Brand Subtitle: A PRODUCT OF GLIDEBAY */}
        <div className="w-full flex items-center justify-center gap-3 mb-10 opacity-90">
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent" style={{ background: 'linear-gradient(to right, transparent, rgba(37,99,235,0.4))' }} />
          <span className="text-[11px] font-display font-bold tracking-[0.22em] uppercase" style={{ color: 'rgba(37,99,235,0.6)' }}>
            A PRODUCT OF <span className="font-display font-extrabold" style={{ color: '#2563EB' }}>GLIDEBAY</span>
          </span>
          <div className="h-[1px] w-12" style={{ background: 'linear-gradient(to left, transparent, rgba(37,99,235,0.4))' }} />
        </div>

        {/* Animated Three Dots */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${dots >= 1 ? 'scale-110' : ''}`}
            style={{ background: dots >= 1 ? '#2563EB' : 'rgba(37,99,235,0.2)', boxShadow: dots >= 1 ? '0 0 10px rgba(37,99,235,0.4)' : 'none' }}
          />
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${dots >= 2 ? 'scale-110' : ''}`}
            style={{ background: dots >= 2 ? '#2563EB' : 'rgba(37,99,235,0.2)', boxShadow: dots >= 2 ? '0 0 10px rgba(37,99,235,0.4)' : 'none' }}
          />
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${dots >= 3 ? 'scale-110' : ''}`}
            style={{ background: dots >= 3 ? '#2563EB' : 'rgba(37,99,235,0.2)', boxShadow: dots >= 3 ? '0 0 10px rgba(37,99,235,0.4)' : 'none' }}
          />
        </div>


        {/* Status text */}
        <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase mb-6" style={{ color: 'rgba(37,99,235,0.5)' }}>
          INITIALIZING SYSTEM...
        </p>

        {/* Quick skip button */}
        <button
          onClick={() => {
            setFading(true);
            setTimeout(dismissLoading, 300);
          }}
          className="text-xs font-display px-4 py-1.5 rounded-full backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          style={{ color: 'rgba(37,99,235,0.5)', border: '1px solid rgba(37,99,235,0.15)' }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#2563EB'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(37,99,235,0.4)'; }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'rgba(37,99,235,0.5)'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(37,99,235,0.15)'; }}
        >
          Skip Intro →
        </button>
      </div>
    </div>
  );
}
