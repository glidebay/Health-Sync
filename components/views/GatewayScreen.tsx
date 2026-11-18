'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Lock,
  Loader2,
  Volume2,
  VolumeX,
  HeartPulse,
} from 'lucide-react';
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

const TESTIMONIALS = [
  {
    quote:
      '“We cut patient lobby wait times in half within days—every doctor chamber and WhatsApp booking stays effortlessly in sync across our clinics.”',
    name: 'Dr. Sofia Hernández',
    role: 'Medical Director, Portland, OR',
  },
  {
    quote:
      '“Switching between branches and tracking real-time prescriptions takes seconds. Our front desk and physicians never miss a patient update.”',
    name: 'Dr. Arjun Menon',
    role: 'Chief Consultant, Kochi, KL',
  },
];

const TILE_POSITIONS: Array<[number, number]> = [
  [2, 0],
  [3, 1],
  [0, 2],
  [2, 2],
  [1, 3],
  [3, 3],
];

export function GatewayScreen({
  onSubmitPin,
}: GatewayScreenProps) {
  const [step, setStep] = useState<GatewayStep>('clinic');
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState<ClinicOption | null>(null);
  const [isClinicOpen, setIsClinicOpen] = useState(false);

  const [branches, setBranches] = useState<DbClinicLocation[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<DbClinicLocation | null>(null);
  const [isBranchOpen, setIsBranchOpen] = useState(false);

  const clinicDropRef = useRef<HTMLDivElement | null>(null);
  const branchDropRef = useRef<HTMLDivElement | null>(null);

  const [pin, setPin] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const quoteRef = useRef<HTMLParagraphElement | null>(null);
  const quoteFootRef = useRef<HTMLDivElement | null>(null);
  const brandRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const sublineRef = useRef<HTMLParagraphElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const actionBtnRef = useRef<HTMLButtonElement | null>(null);
  const footerLineRef = useRef<HTMLParagraphElement | null>(null);
  const entrancePlayedRef = useRef(false);

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
          list = clinicRows.map(
            (c: { id: string; name: string; slug?: string | null }) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
            })
          );
        } else {
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
          if (list.length > 0) {
            setSelectedClinic(list[0]);
          }
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
    const onOutside = (e: MouseEvent) => {
      if (clinicDropRef.current && !clinicDropRef.current.contains(e.target as Node)) {
        setIsClinicOpen(false);
      }
      if (branchDropRef.current && !branchDropRef.current.contains(e.target as Node)) {
        setIsBranchOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // Coordinated ~2s WAAPI entrance timeline when fonts are ready
  useEffect(() => {
    if (entrancePlayedRef.current) return;
    entrancePlayedRef.current = true;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof Element.prototype.animate !== 'function') return;

    const runEntrance = () => {
      const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
      const animateEl = (
        el: Element | null,
        from: Keyframe,
        to: Keyframe,
        delay: number,
        duration: number
      ) => {
        if (!el) return;
        el.animate([from, to], { delay, duration, easing: ease, fill: 'both' });
      };

      animateEl(
        quoteRef.current,
        { opacity: 0, clipPath: 'inset(100% 0 0 0)', transform: 'translateY(14px)' },
        { opacity: 1, clipPath: 'inset(0 0 0 0)', transform: 'none' },
        80,
        780
      );
      animateEl(
        quoteFootRef.current,
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'none' },
        320,
        620
      );
      animateEl(
        brandRef.current,
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'none' },
        240,
        560
      );
      animateEl(
        headingRef.current,
        { opacity: 0, clipPath: 'inset(100% 0 0 0)', transform: 'translateY(12px)' },
        { opacity: 1, clipPath: 'inset(0 0 0 0)', transform: 'none' },
        420,
        680
      );
      animateEl(
        sublineRef.current,
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' },
        560,
        540
      );

      const cards = gridRef.current?.querySelectorAll('[data-gw-card]');
      cards?.forEach((card, idx) => {
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        animateEl(
          card,
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'none' },
          680 + row * 155 + col * 55,
          540
        );
      });

      animateEl(
        actionBtnRef.current,
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'none' },
        1280,
        540
      );
      animateEl(
        footerLineRef.current,
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' },
        1420,
        500
      );
    };

    const fontReady = document.fonts?.ready ?? Promise.resolve();
    Promise.race([fontReady, new Promise((r) => setTimeout(r, 600))]).then(() => {
      requestAnimationFrame(() => requestAnimationFrame(runEntrance));
    });
  }, []);

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

  const handlePinVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const activeTestimonial = TESTIMONIALS[testimonialIdx % TESTIMONIALS.length];

  return (
    <>
      <style>{`
        .gw-shell {
          --u: clamp(0.7px, min(100vw / 1447, 100vh / 1087), 2.4px);
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          background: #F8F9FB;
          color: #0F172A;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          display: grid;
          grid-template-columns: minmax(0, 1fr) max(calc(508.7 * var(--u)), 45%);
          padding: calc(11.5 * var(--u)) 0 calc(15.7 * var(--u)) calc(15.6 * var(--u));
          overflow: hidden;
          user-select: none;
        }

        /* LEFT VIDEO CARD */
        .gw-photo-card {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 0 calc(24 * var(--u)) calc(24 * var(--u)) calc(24 * var(--u));
          overflow: hidden;
          background: #F8F9FB;
        }
        .gw-media {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          transform: scale(1.03);
          display: block;
        }
        .gw-mute-btn {
          position: absolute;
          top: calc(18 * var(--u));
          right: calc(18 * var(--u));
          z-index: 10;
          width: calc(40 * var(--u));
          height: calc(40 * var(--u));
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.18s ease;
        }
        .gw-mute-btn:hover {
          background: rgba(37, 99, 235, 0.85);
        }

        /* 4x4 TOP-LEFT CUTOUT & FROSTED TILE PATTERN (61u grid) */
        .gw-tiles {
          position: absolute;
          top: 0;
          left: 0;
          width: calc(244 * var(--u));
          height: calc(244 * var(--u));
          pointer-events: none;
          z-index: 4;
        }
        .gw-tile-cutout-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: calc(76 * var(--u));
          height: calc(76 * var(--u));
          display: block;
        }
        .gw-tile-frost {
          position: absolute;
          width: calc(61 * var(--u));
          height: calc(61 * var(--u));
          border-radius: calc(15 * var(--u));
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(calc(8 * var(--u)));
          -webkit-backdrop-filter: blur(calc(8 * var(--u)));
        }

        /* BOTTOM FROSTED GLASS TESTIMONIAL BAND */
        .gw-bottom-glass {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: calc(240 * var(--u));
          z-index: 5;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 0 calc(40 * var(--u)) calc(32 * var(--u));
        }
        .gw-bottom-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          backdrop-filter: blur(calc(22 * var(--u)));
          -webkit-backdrop-filter: blur(calc(22 * var(--u)));
          background: linear-gradient(
            180deg,
            rgba(15, 23, 42, 0) 0%,
            rgba(15, 23, 42, 0.28) 54%,
            rgba(15, 23, 42, 0.20) 100%
          );
          mask-image: linear-gradient(to bottom, transparent 0%, black 38%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 38%);
          pointer-events: none;
          z-index: 0;
        }
        .gw-bottom-glass > * {
          position: relative;
          z-index: 1;
        }
        .gw-quote {
          color: #FFFFFF;
          font-weight: 500;
          font-size: calc(21 * var(--u));
          line-height: calc(30 * var(--u));
          max-width: calc(680 * var(--u));
          margin: 0 0 calc(18 * var(--u)) 0;
        }
        .gw-quote-foot {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: calc(16 * var(--u));
        }
        .gw-author-name {
          color: #FFFFFF;
          font-weight: 600;
          font-size: calc(20.5 * var(--u));
          line-height: 1.25;
        }
        .gw-author-role {
          color: rgba(255, 255, 255, 0.86);
          font-weight: 500;
          font-size: calc(16.25 * var(--u));
          margin-top: calc(3 * var(--u));
        }
        .gw-arrows {
          display: flex;
          align-items: center;
          gap: calc(31 * var(--u));
          flex-shrink: 0;
        }
        .gw-arrow-btn {
          width: calc(59 * var(--u));
          height: calc(59 * var(--u));
          border-radius: 999px;
          border: calc(1.5 * var(--u)) solid rgba(255, 255, 255, 0.9);
          background: transparent;
          color: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .gw-arrow-btn:hover {
          background: rgba(255, 255, 255, 0.14);
        }
        .gw-arrow-btn:active {
          transform: scale(0.96);
        }

        /* RIGHT FORM COLUMN (Medium-Small Balanced Scale) */
        .gw-form-pane {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 clamp(24px, 3.5vw, 56px);
        }
        .gw-form-col {
          width: min(100%, 380px);
          display: flex;
          flex-direction: column;
        }
        .gw-brand {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: #2563EB;
          font-weight: 700;
          font-size: 21px;
          letter-spacing: -0.02em;
        }
        .gw-brand-heart {
          width: calc(24 * var(--u));
          height: calc(24 * var(--u));
          min-width: 22px;
          min-height: 22px;
          stroke-width: 2.3;
          color: #2563EB;
          flex-shrink: 0;
        }
        .gw-heading {
          margin: 26px 0 0 0;
          color: #0F172A;
          font-weight: 700;
          font-size: 24px;
          line-height: 1.2;
          letter-spacing: -0.025em;
        }
        .gw-subline {
          margin: 7px 0 0 0;
          color: #64748B;
          font-weight: 400;
          font-size: 14.5px;
          line-height: 1.45;
        }

        /* DROPDOWN SELECTOR */
        .gw-dropdown-wrap {
          position: relative;
          margin-top: 22px;
        }
        .gw-dropdown-btn {
          width: 100%;
          height: 50px;
          border-radius: 12px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          padding: 0 16px;
          font-size: 14.5px;
          font-weight: 500;
          color: #0F172A;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          transition: border-color 0.16s ease, background 0.16s ease;
        }
        .gw-dropdown-btn:hover:not(:disabled) {
          border-color: #CBD5E1;
          background: #F8FAFC;
        }
        .gw-dropdown-btn[aria-expanded="true"] {
          border-color: #2563EB;
          background: #EFF6FF;
        }
        .gw-dropdown-menu {
          position: absolute;
          left: 0;
          right: 0;
          top: 56px;
          max-height: 220px;
          overflow-y: auto;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
          padding: 6px;
          z-index: 50;
        }
        .gw-dropdown-item {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 0;
          background: transparent;
          color: #0F172A;
          font-size: 14px;
          font-weight: 500;
          text-align: left;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          cursor: pointer;
          transition: background 0.14s ease;
        }
        .gw-dropdown-item:hover {
          background: #F1F5F9;
        }
        .gw-dropdown-item.gw-dropdown-item-active {
          background: #EFF6FF;
          color: #2563EB;
          font-weight: 600;
        }

        /* PIN INPUT (STEP 3) */
        .gw-pin-box {
          margin-top: 22px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .gw-pin-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .gw-pin-icon {
          position: absolute;
          left: 16px;
          color: #2563EB;
          pointer-events: none;
        }
        .gw-pin-input {
          width: 100%;
          height: 50px;
          border-radius: 12px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          padding: 0 16px 0 42px;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: #0F172A;
          outline: none;
          transition: border-color 0.16s ease, background 0.16s ease;
        }
        .gw-pin-input:focus {
          border-color: #2563EB;
          background: #EFF6FF;
        }
        .gw-error {
          font-size: 13px;
          font-weight: 500;
          color: #B91C1C;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 10px;
          padding: 9px 12px;
        }

        /* PRIMARY DASHBOARD BLUE PILL BUTTON */
        .gw-btn-primary {
          margin-top: 20px;
          width: 100%;
          height: 48px;
          border-radius: 999px;
          border: 0;
          background: #2563EB;
          color: #FFFFFF;
          font-weight: 600;
          font-size: 14.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: background 0.16s ease, transform 0.14s ease;
        }
        .gw-btn-primary:hover:not(:disabled) {
          background: #1D4ED8;
        }
        .gw-btn-primary:active:not(:disabled) {
          transform: scale(0.99);
        }
        .gw-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .gw-btn-secondary {
          margin-top: 10px;
          width: 100%;
          height: 48px;
          border-radius: 999px;
          border: 1.5px solid #CBD5E1;
          background: #FFFFFF;
          color: #0F172A;
          font-weight: 600;
          font-size: 14.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.14s ease;
        }
        .gw-btn-secondary:hover {
          background: #F8FAFC;
          border-color: #94A3B8;
        }
        .gw-btn-secondary:active {
          transform: scale(0.99);
        }

        /* TABLET PORTRAIT */
        @media (max-width: 1024px) and (orientation: portrait) {
          .gw-shell {
            grid-template-columns: 1fr;
            grid-template-rows: 40vh 1fr;
            padding: 12px;
            gap: 16px;
          }
          .gw-photo-card {
            border-radius: 18px;
          }
          .gw-tiles { display: none; }
          .gw-bottom-glass { height: 180px; padding: 16px 24px; }
          .gw-quote { font-size: 18px; line-height: 1.35; margin-bottom: 10px; }
          .gw-form-col { width: min(640px, 100%); }
          .gw-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
          .gw-card { height: 108px; padding: 12px; }
          .gw-heading { margin-top: 20px; font-size: 24px; }
          .gw-btn-primary { margin-top: 20px; height: 48px; }
        }

        /* PHONE (<700px) — fits one screen cleanly */
        @media (max-width: 699px) {
          .gw-shell {
            grid-template-columns: 1fr;
            grid-template-rows: 26vh 1fr;
            padding: 10px;
            gap: 12px;
          }
          .gw-photo-card { border-radius: 16px; }
          .gw-tiles { display: none; }
          .gw-bottom-glass { height: 150px; padding: 12px 16px; }
          .gw-quote {
            font-size: 13px;
            line-height: 1.35;
            margin-bottom: 8px;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .gw-author-name { font-size: 12px; }
          .gw-author-role { font-size: 10.5px; }
          .gw-arrows { gap: 8px; }
          .gw-arrow-btn { width: 32px; height: 32px; border-width: 1px; }
          .gw-form-pane { padding: 0 8px; align-items: flex-start; }
          .gw-form-col { width: 100%; }
          .gw-brand { font-size: 18px; }
          .gw-heading { margin-top: 12px; font-size: 20px; }
          .gw-subline { font-size: 13px; margin-top: 4px; }
          .gw-grid {
            margin-top: 14px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .gw-card {
            height: 64px;
            padding: 10px 12px;
            flex-direction: row;
            align-items: center;
            gap: 10px;
          }
          .gw-card-top { width: auto; }
          .gw-checkbox { display: none; }
          .gw-icon-tile { width: 32px; height: 32px; border-radius: 8px; }
          .gw-card-name { font-size: 13px; }
          .gw-card-domain { display: none; }
          .gw-pin-input { height: 48px; font-size: 16px; }
          .gw-btn-primary { margin-top: 14px; height: 46px; font-size: 14px; }
          .gw-btn-secondary { margin-top: 10px; height: 46px; font-size: 14px; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>

      <div className="gw-shell">
        {/* ============================================================== */}
        {/* LEFT: USER VIDEO + TILE CUTOUT + TESTIMONIAL CARD              */}
        {/* ============================================================== */}
        <section className="gw-photo-card">
          <video
            ref={videoRef}
            className="gw-media"
            autoPlay
            muted={isMuted}
            loop
            playsInline
            preload="auto"
          >
            <source src="/gateway-video.mp4" type="video/mp4" />
          </video>

          <button
            type="button"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            className="gw-mute-btn"
            onClick={() => {
              const next = !isMuted;
              if (videoRef.current) videoRef.current.muted = next;
              setIsMuted(next);
            }}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* 4x4 Top-Left Cutout & Frosted Tile Pattern */}
          <div className="gw-tiles" aria-hidden="true">
            <svg
              viewBox="0 0 76 76"
              fill="none"
              className="gw-tile-cutout-svg"
            >
              <path
                d="M0 0H76A15 15 0 0 0 61 15V46A15 15 0 0 1 46 61H15A15 15 0 0 0 0 76Z"
                fill="#F8F9FB"
              />
            </svg>
            {TILE_POSITIONS.map(([col, row], i) => (
              <div
                key={i}
                className="gw-tile-frost"
                style={{
                  left: `calc(${col * 61} * var(--u))`,
                  top: `calc(${row * 61} * var(--u))`,
                }}
              />
            ))}
          </div>

          {/* Bottom Forest-Tinted Frosted Glass Testimonial Band */}
          <div className="gw-bottom-glass">
            <p ref={quoteRef} className="gw-quote">
              {activeTestimonial.quote}
            </p>
            <div ref={quoteFootRef} className="gw-quote-foot">
              <div className="gw-arrows">
                <button
                  type="button"
                  aria-label="Previous testimonial"
                  className="gw-arrow-btn"
                  onClick={() =>
                    setTestimonialIdx((i) =>
                      (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length
                    )
                  }
                >
                  <ArrowLeft className="w-[40%] h-[40%]" />
                </button>
                <button
                  type="button"
                  aria-label="Next testimonial"
                  className="gw-arrow-btn"
                  onClick={() =>
                    setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length)
                  }
                >
                  <ArrowRight className="w-[40%] h-[40%]" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* RIGHT: HEALTHSYNC CLINIC -> (BRANCH) -> PIN FLOW               */}
        {/* ============================================================== */}
        <section className="gw-form-pane">
          <div className="gw-form-col">
            {/* HealthSync Blue Wordmark with Heart Icon */}
            <div ref={brandRef} className="gw-brand">
              <HeartPulse
                className="gw-brand-heart"
                aria-hidden="true"
              />
              <span>HealthSync</span>
            </div>

            {/* Heading & Subline */}
            <h1 ref={headingRef} className="gw-heading">
              {step === 'clinic'
                ? 'Which clinic are you entering?'
                : step === 'branch'
                  ? 'Select your branch'
                  : 'Enter security PIN'}
            </h1>
            <p ref={sublineRef} className="gw-subline">
              {step === 'clinic'
                ? 'We’ll connect you with your live queues & chambers.'
                : step === 'branch'
                  ? `Choose a branch under ${selectedClinic?.name || 'your clinic'}.`
                  : `Verify access for ${
                      selectedBranch
                        ? `${selectedClinic?.name} · ${selectedBranch.branch_name}`
                        : selectedClinic?.name
                    }.`}
            </p>

            {/* STEP 1: CLINIC DROPDOWN */}
            {step === 'clinic' && (
              <div ref={clinicDropRef} className="gw-dropdown-wrap">
                <button
                  type="button"
                  aria-expanded={isClinicOpen}
                  disabled={isLoadingClinics}
                  onClick={() => setIsClinicOpen((p) => !p)}
                  className="gw-dropdown-btn"
                >
                  <span className="truncate">
                    {isLoadingClinics
                      ? 'Loading clinics...'
                      : selectedClinic
                        ? selectedClinic.name
                        : 'Select a clinic'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#64748B] flex-shrink-0 transition-transform ${
                      isClinicOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isClinicOpen && (
                  <div className="gw-dropdown-menu">
                    {clinics.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-[#64748B]">
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
                              setIsClinicOpen(false);
                              setErrorMsg('');
                            }}
                            className={`gw-dropdown-item ${
                              isSelected ? 'gw-dropdown-item-active' : ''
                            }`}
                          >
                            <span className="truncate">{clinic.name}</span>
                            {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: BRANCH DROPDOWN (IF CLINIC HAS BRANCHES) */}
            {step === 'branch' && (
              <div ref={branchDropRef} className="gw-dropdown-wrap">
                <button
                  type="button"
                  aria-expanded={isBranchOpen}
                  onClick={() => setIsBranchOpen((p) => !p)}
                  className="gw-dropdown-btn"
                >
                  <span className="truncate">
                    {selectedBranch ? selectedBranch.branch_name : 'Select a branch'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#64748B] flex-shrink-0 transition-transform ${
                      isBranchOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isBranchOpen && (
                  <div className="gw-dropdown-menu">
                    {branches.map((branch) => {
                      const isSelected = selectedBranch?.id === branch.id;
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            setSelectedBranch(branch);
                            setIsBranchOpen(false);
                            setErrorMsg('');
                          }}
                          className={`gw-dropdown-item ${
                            isSelected ? 'gw-dropdown-item-active' : ''
                          }`}
                        >
                          <span className="truncate">
                            {branch.branch_name}
                            {branch.branch_code ? ` (${branch.branch_code})` : ''}
                          </span>
                          {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: SECURITY PIN ENTRY */}
            {step === 'pin' && (
              <form onSubmit={handlePinVerify} className="gw-pin-box">
                <div className="gw-pin-wrap">
                  <Lock className="gw-pin-icon w-4 h-4" />
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="Enter clinic or doctor PIN"
                    autoFocus
                    className="gw-pin-input"
                  />
                </div>
                {errorMsg && <div className="gw-error">{errorMsg}</div>}
              </form>
            )}

            {step !== 'pin' && errorMsg && (
              <div className="gw-error mt-3">{errorMsg}</div>
            )}

            {/* Primary Forest Pill Action Button */}
            <button
              ref={actionBtnRef}
              type="button"
              className="gw-btn-primary"
              disabled={
                (step === 'clinic' && (!selectedClinic || isLoadingBranches)) ||
                (step === 'branch' && !selectedBranch) ||
                (step === 'pin' && (isVerifyingPin || !pin.trim()))
              }
              onClick={() => {
                if (step === 'clinic') handleClinicNext();
                else if (step === 'branch') handleBranchNext();
                else handlePinVerify();
              }}
            >
              {(isLoadingBranches || isVerifyingPin) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              <span>
                {step === 'clinic'
                  ? isLoadingBranches
                    ? 'Checking branches...'
                    : 'Continue'
                  : step === 'branch'
                    ? 'Continue'
                    : isVerifyingPin
                      ? 'Verifying PIN...'
                      : 'Unlock Clinic'}
              </span>
            </button>

            {/* Same-length Back Pill Button on Branch & PIN steps */}
            {step !== 'clinic' && (
              <button
                ref={footerLineRef as unknown as React.RefObject<HTMLButtonElement>}
                type="button"
                className="gw-btn-secondary"
                onClick={() => {
                  setErrorMsg('');
                  if (step === 'branch') {
                    setStep('clinic');
                  } else {
                    setPin('');
                    setStep(branches.length > 0 ? 'branch' : 'clinic');
                  }
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>
                  {step === 'branch'
                    ? 'Back to Clinics'
                    : branches.length > 0
                      ? 'Back to Branches'
                      : 'Back to Clinics'}
                </span>
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export default GatewayScreen;
