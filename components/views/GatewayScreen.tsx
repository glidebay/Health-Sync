'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  ChevronDown,
  Check,
  ArrowRight,
  ArrowLeft,
  Building2,
  MapPin,
  Lock,
  Loader2,
} from 'lucide-react';
import { MacbookPro } from '@/components/ui/macbook-pro';
import { supabase } from '@/lib/supabaseClient';
import { fetchClinicLocations } from '@/lib/supabaseService';
import { DbClinicLocation } from '@/types/database';

export interface ClinicOption {
  id: string;
  name: string;
  slug?: string | null;
}

export interface GatewayPinSubmitPayload {
  pin: string;
  clinic: ClinicOption;
  branch: DbClinicLocation | null;
}

export interface GatewayScreenProps {
  onSelectBookSlot?: () => void;
  onSelectConsulting?: () => void;
  onSubmitPin?: (
    payload: GatewayPinSubmitPayload
  ) => Promise<{ success: boolean; message?: string }>;
  waitingCount?: number;
  doctorName?: string;
  doctorSpecialty?: string;
}

type GatewayStep = 'clinic' | 'branch' | 'pin';

export function GatewayScreen({ onSubmitPin }: GatewayScreenProps) {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Step state: clinic -> (optional) branch -> pin
  const [step, setStep] = useState<GatewayStep>('clinic');

  // Clinics from Supabase
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState<ClinicOption | null>(null);
  const [isClinicDropdownOpen, setIsClinicDropdownOpen] = useState(false);
  const clinicDropdownRef = useRef<HTMLDivElement>(null);

  // Branches for selected clinic
  const [branches, setBranches] = useState<DbClinicLocation[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<DbClinicLocation | null>(null);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // PIN verification state
  const [pin, setPin] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load clinics from Supabase on mount
  useEffect(() => {
    let active = true;
    async function loadClinics() {
      setIsLoadingClinics(true);
      try {
        const { data: clinicRows, error } = await supabase
          .from('clinics')
          .select('id, name, slug')
          .order('name', { ascending: true });

        let list: ClinicOption[] = [];
        if (!error && clinicRows && clinicRows.length > 0) {
          list = clinicRows.map((c: { id: string; name: string; slug?: string | null }) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
          }));
        } else {
          // Fallback: derive unique clinics from active clinic_locations
          const locs = await fetchClinicLocations();
          const map = new Map<string, ClinicOption>();
          locs.forEach((l) => {
            if (l.clinic_id && !map.has(l.clinic_id)) {
              map.set(l.clinic_id, {
                id: l.clinic_id,
                name: l.clinic_name || l.branch_name,
              });
            }
          });
          list = Array.from(map.values());
        }

        if (active) {
          setClinics(list);
        }
      } catch {
        if (active) setClinics([]);
      } finally {
        if (active) setIsLoadingClinics(false);
      }
    }
    loadClinics();
    return () => {
      active = false;
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        clinicDropdownRef.current &&
        !clinicDropdownRef.current.contains(e.target as Node)
      ) {
        setIsClinicDropdownOpen(false);
      }
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(e.target as Node)
      ) {
        setIsBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleClinicNext = async () => {
    if (!selectedClinic) return;
    setErrorMsg('');
    setIsLoadingBranches(true);
    try {
      const clinicBranches = await fetchClinicLocations(selectedClinic.id);
      setBranches(clinicBranches);
      if (clinicBranches.length > 0) {
        setSelectedBranch(clinicBranches[0]);
        setStep('branch');
      } else {
        setSelectedBranch(null);
        setStep('pin');
      }
    } catch {
      setBranches([]);
      setSelectedBranch(null);
      setStep('pin');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleBranchNext = () => {
    if (!selectedBranch) return;
    setErrorMsg('');
    setStep('pin');
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic) return;
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setErrorMsg('Please enter your clinic or doctor PIN.');
      return;
    }

    setErrorMsg('');
    setIsVerifyingPin(true);
    try {
      if (onSubmitPin) {
        const res = await onSubmitPin({
          pin: cleanPin,
          clinic: selectedClinic,
          branch: selectedBranch,
        });
        if (!res.success) {
          setErrorMsg(res.message || 'Invalid PIN for the selected clinic.');
        }
      }
    } catch {
      setErrorMsg('Verification failed. Please try again.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#F8F9FB] text-[#0F172A] overflow-hidden select-none font-['Inter',sans-serif]">
      {/* Background Gradient & Crisp Overlapping Circle Shapes (Project Unified Palette) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-[#F8F9FB] via-[#EFF6FF] to-[#DBEAFE]">
        <div className="absolute -top-[42vw] -left-[8vw] w-[75vw] h-[75vw] rounded-full bg-[#38BDF8]/[0.14]" />
        <div className="absolute -bottom-[16vw] -right-[10vw] w-[42vw] h-[42vw] rounded-full bg-[#2563EB]/[0.09]" />
        <div className="absolute -bottom-[10vw] -left-[12vw] w-[28vw] h-[28vw] rounded-full bg-[#60A5FA]/[0.12]" />
      </div>

      {/* DOT GRID — top-left decorative */}
      <div className="absolute top-20 left-6 z-10 grid grid-cols-4 gap-[7px] opacity-30 pointer-events-none">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
        ))}
      </div>

      {/* ============================================================== */}
      {/* LEFT: MacBook Pro — completely contained with comfortable margins */}
      {/* ============================================================== */}
      <div
        className="absolute z-20 flex items-center justify-center"
        style={{
          left: '1%',
          top: '11%',
          bottom: '6%',
          width: '48%',
        }}
      >
        <MacbookPro
          style={{
            width: 'min(43vw, 84vh)',
            maxWidth: '740px',
          }}
        >
          <div className="relative w-full h-full bg-black">
            <div className="absolute inset-0 pointer-events-none z-[25] bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.10]" />
            <video
              ref={videoRef}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              src="/gateway-video.mp4"
              className="w-full h-full object-cover block"
            />
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="absolute bottom-3 right-3 z-30 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white shadow-lg flex items-center justify-center transition cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </MacbookPro>
      </div>

      {/* ============================================================== */}
      {/* RIGHT: Multi-step Clinic -> (Branch) -> PIN Gateway Flow       */}
      {/* ============================================================== */}
      <div
        className="absolute flex flex-col justify-center px-8 lg:px-14 z-30"
        style={{
          right: '1%',
          top: '11%',
          bottom: '6%',
          width: '48%',
        }}
      >
        {/* STEP 1: CHOOSE CLINIC */}
        {step === 'clinic' && (
          <div className="max-w-lg w-full">
            <h1 className="font-['Montserrat',sans-serif] font-black text-4xl sm:text-5xl xl:text-[3.5rem] leading-[0.98] tracking-tight uppercase text-[#0F172A] mb-5">
              <span className="block whitespace-nowrap">CHOOSE YOUR</span>
              <span className="block whitespace-nowrap text-[#2563EB]">CLINIC</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 font-medium mb-7 leading-relaxed">
              Selecting your clinic routes live patient queues, doctor chambers,
              and appointment slots to the right medical facility before
              entering your security PIN.
            </p>

            {/* Glass-effect Clinic Dropdown */}
            <div ref={clinicDropdownRef} className="relative mb-5">
              <button
                type="button"
                onClick={() => setIsClinicDropdownOpen((prev) => !prev)}
                disabled={isLoadingClinics}
                className="w-full px-5 py-4 rounded-2xl bg-white/80 hover:bg-white backdrop-blur-xl border border-blue-200/80 text-[#0F172A] font-semibold text-sm shadow-lg shadow-blue-500/5 flex items-center justify-between gap-3 transition cursor-pointer"
              >
                <span className="flex items-center gap-3 truncate">
                  <Building2 className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                  <span className="truncate">
                    {isLoadingClinics
                      ? 'Loading clinics...'
                      : selectedClinic
                        ? selectedClinic.name
                        : 'Select a clinic'}
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
                    isClinicDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isClinicDropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-2xl bg-white/95 backdrop-blur-xl border border-blue-100 shadow-2xl shadow-blue-900/10 z-50 p-1.5">
                  {clinics.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-500">
                      No active clinics found.
                    </div>
                  ) : (
                    clinics.map((clinic) => {
                      const isSelected = selectedClinic?.id === clinic.id;
                      return (
                        <button
                          key={clinic.id}
                          type="button"
                          onClick={() => {
                            setSelectedClinic(clinic);
                            setIsClinicDropdownOpen(false);
                            setErrorMsg('');
                          }}
                          className={`w-full px-4 py-3 rounded-xl text-left text-sm font-medium flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 text-[#2563EB] font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{clinic.name}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2 mb-4">
                {errorMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleClinicNext}
              disabled={!selectedClinic || isLoadingBranches}
              className="px-8 py-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-blue-600/25 hover:-translate-y-0.5 transition cursor-pointer inline-flex items-center gap-2.5 group"
            >
              {isLoadingBranches ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking Branches...</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: CHOOSE BRANCH (only if clinic has branches) */}
        {step === 'branch' && selectedClinic && (
          <div className="max-w-lg w-full">
            <h1 className="font-['Montserrat',sans-serif] font-black text-4xl sm:text-5xl xl:text-[3.5rem] leading-[0.98] tracking-tight uppercase text-[#0F172A] mb-5">
              <span className="block whitespace-nowrap">SELECT</span>
              <span className="block whitespace-nowrap text-[#2563EB]">BRANCH</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 font-medium mb-7 leading-relaxed">
              <span className="font-bold text-[#0F172A]">{selectedClinic.name}</span>{' '}
              operates multiple branches. Choose your branch location so the
              queue desk and doctor chambers sync accurately.
            </p>

            {/* Glass-effect Branch Dropdown */}
            <div ref={branchDropdownRef} className="relative mb-6">
              <button
                type="button"
                onClick={() => setIsBranchDropdownOpen((prev) => !prev)}
                className="w-full px-5 py-4 rounded-2xl bg-white/80 hover:bg-white backdrop-blur-xl border border-blue-200/80 text-[#0F172A] font-semibold text-sm shadow-lg shadow-blue-500/5 flex items-center justify-between gap-3 transition cursor-pointer"
              >
                <span className="flex items-center gap-3 truncate">
                  <MapPin className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                  <span className="truncate">
                    {selectedBranch
                      ? selectedBranch.branch_name
                      : 'Select a branch'}
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
                    isBranchDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isBranchDropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-2xl bg-white/95 backdrop-blur-xl border border-blue-100 shadow-2xl shadow-blue-900/10 z-50 p-1.5">
                  {branches.map((branch) => {
                    const isSelected = selectedBranch?.id === branch.id;
                    return (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => {
                          setSelectedBranch(branch);
                          setIsBranchDropdownOpen(false);
                          setErrorMsg('');
                        }}
                        className={`w-full px-4 py-3 rounded-xl text-left text-sm font-medium flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-[#2563EB] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">
                          {branch.branch_name}
                          {branch.branch_code ? ` (${branch.branch_code})` : ''}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setStep('clinic');
                }}
                className="px-5 py-4 rounded-xl bg-white/80 hover:bg-white backdrop-blur-md border border-slate-200 text-slate-700 font-bold text-sm transition cursor-pointer inline-flex items-center gap-2 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleBranchNext}
                disabled={!selectedBranch}
                className="px-8 py-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-blue-600/25 hover:-translate-y-0.5 transition cursor-pointer inline-flex items-center gap-2.5 group"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ENTER CLINIC / DOCTOR PIN */}
        {step === 'pin' && selectedClinic && (
          <form onSubmit={handlePinSubmit} className="max-w-lg w-full">
            <h1 className="font-['Montserrat',sans-serif] font-black text-4xl sm:text-5xl xl:text-[3.5rem] leading-[0.98] tracking-tight uppercase text-[#0F172A] mb-5">
              <span className="block whitespace-nowrap">ENTER</span>
              <span className="block whitespace-nowrap text-[#2563EB]">CLINIC PIN</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 font-medium mb-7 leading-relaxed">
              Verify access for{' '}
              <span className="font-bold text-[#0F172A]">
                {selectedBranch
                  ? `${selectedClinic.name} • ${selectedBranch.branch_name}`
                  : selectedClinic.name}
              </span>{' '}
              using your branch gateway PIN or doctor chamber PIN.
            </p>

            {/* Glass-effect PIN Input */}
            <div className="relative mb-5">
              <Lock className="w-4 h-4 text-[#2563EB] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter security PIN"
                autoFocus
                className="w-full pl-11 pr-5 py-4 rounded-2xl bg-white/80 focus:bg-white backdrop-blur-xl border border-blue-200/80 focus:border-[#2563EB] text-[#0F172A] placeholder:text-slate-400 font-semibold text-sm tracking-widest outline-none shadow-lg shadow-blue-500/5 transition"
              />
            </div>

            {errorMsg && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2 mb-4">
                {errorMsg}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setPin('');
                  setStep(branches.length > 0 ? 'branch' : 'clinic');
                }}
                className="px-5 py-4 rounded-xl bg-white/80 hover:bg-white backdrop-blur-md border border-slate-200 text-slate-700 font-bold text-sm transition cursor-pointer inline-flex items-center gap-2 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isVerifyingPin || !pin.trim()}
                className="px-8 py-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-blue-600/25 hover:-translate-y-0.5 transition cursor-pointer inline-flex items-center gap-2.5 group"
              >
                {isVerifyingPin ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Clinic</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* DOT GRID — bottom-right decorative */}
        <div className="absolute bottom-10 right-6 grid grid-cols-4 gap-[7px] opacity-25 pointer-events-none">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default GatewayScreen;
