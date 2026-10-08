'use client';

import React, { useState } from 'react';
import { useClinic } from '@/context/ClinicContext';
import { Lock, ShieldCheck, X, KeyRound, AlertCircle } from 'lucide-react';

export default function DoctorAuthModal() {
  const { isAuthModalOpen, closeAuthModal, authenticateDoctor } = useClinic();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const success = authenticateDoctor(pin);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    } else {
      setPin('');
      setError(false);
    }
  };

  const handleKeyClick = (val: string) => {
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);
      if (newPin.length === 4) {
        const success = authenticateDoctor(newPin);
        if (!success) {
          setError(true);
          setTimeout(() => setError(false), 2000);
        } else {
          setPin('');
          setError(false);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleQuickDemo = () => {
    setPin('1234');
    authenticateDoctor('1234');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md transition-all animate-fadeIn">
      <div
        className={`relative w-full max-w-sm rounded-[24px] bg-white/95 backdrop-blur-2xl p-7 shadow-2xl border border-slate-200/80 ring-1 ring-slate-900/10 transition-transform ${
          error ? 'animate-shake ring-2 ring-rose-500' : ''
        }`}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Doctor Security Icon */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 mb-3 border border-white/20">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-display font-bold text-slate-900 tracking-tight">Doctor Authentication</h2>
          <p className="text-xs font-sans text-slate-500 mt-1">
            Restricted to clinical staff & licensed physicians
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-3.5 mb-6">
          {[0, 1, 2, 3].map(index => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                  isFilled
                    ? 'bg-blue-600 border-blue-600 scale-110 shadow-xs shadow-blue-500/50'
                    : 'border-slate-300 bg-slate-100'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-1.5 text-rose-600 text-xs font-display font-semibold mb-4 bg-rose-50 py-2 rounded-xl border border-rose-100 shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Invalid Security PIN. Try 1234.</span>
          </div>
        )}

        {/* Numeric Keypad (Nexuma Style) */}
        <div className="grid grid-cols-3 gap-2.5 mb-5 max-w-[240px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handleKeyClick(num)}
              className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-blue-50 text-slate-800 text-lg font-display font-semibold border border-slate-200/80 transition-all active:scale-95 flex items-center justify-center shadow-2xs cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleQuickDemo}
            title="Auto-fill 1234"
            className="h-12 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-display font-bold border border-blue-200/80 transition-all active:scale-95 flex flex-col items-center justify-center shadow-2xs cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 mb-0.5" />
            <span>Demo</span>
          </button>
          <button
            onClick={() => handleKeyClick('0')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-blue-50 text-slate-800 text-lg font-display font-semibold border border-slate-200/80 transition-all active:scale-95 flex items-center justify-center shadow-2xs cursor-pointer"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-display font-semibold border border-slate-200/80 transition-all active:scale-95 flex items-center justify-center shadow-2xs cursor-pointer"
          >
            ⌫
          </button>
        </div>

        {/* Demo PIN helper callout */}
        <div className="text-center pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] font-sans text-slate-400 font-medium">
            Authorized PIN: <strong className="text-blue-600 font-display font-bold">1234</strong>
          </span>
          <button
            onClick={handleQuickDemo}
            className="text-[11px] font-display font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            Auto-fill PIN
          </button>
        </div>
      </div>
    </div>
  );
}
