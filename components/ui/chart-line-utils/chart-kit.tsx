'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type Point = [number, number];
export type ChartCurve = 'smooth' | 'linear';
export type ChartDatum = Record<string, any>;

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
  texture?: 'solid' | 'dots' | 'hatch';
}

export type ValueFormat =
  | 'number'
  | 'currency'
  | 'percent'
  | 'compact'
  | ((v: number) => string);

export interface ChartBaseProps {
  title?: string;
  description?: string;
  titleSize?: 'sm' | 'md' | 'lg';
  surface?: 'dark' | 'light';
  accent?: string;
  palette?: string[];
  icon?: React.ReactNode;
  radius?: string;
  bare?: boolean;
  animate?: boolean;
  duration?: number;
  delay?: number;
  once?: boolean;
  valueFormat?: ValueFormat;
  currency?: string;
  decimals?: number;
  className?: string;
}

export const HEALTH_SYNC_PALETTE = [
  '#2563EB', // Brand Royal Blue
  '#10B981', // Emerald Health Green
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#EC4899', // Rose
];

export function chartTheme(surface: 'dark' | 'light' = 'light', accent = '#2563EB') {
  if (surface === 'dark') {
    return {
      bg: '#0F172A',
      card: '#1E293B',
      fg: '#F8FAFC',
      muted: '#94A3B8',
      subtle: '#334155',
      grid: '#1E293B',
      accent: accent || '#3B82F6',
      border: '#334155',
    };
  }

  return {
    bg: '#FFFFFF',
    card: '#FFFFFF',
    fg: '#16191E',
    muted: '#8A909D',
    subtle: '#ECEEF2',
    grid: '#F1F3F5',
    accent: accent || '#2563EB',
    border: '#ECEEF2',
  };
}

export function toNumber(v: any): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (!v) return 0;
  const parsed = parseFloat(String(v).replace(/[^0-9.-]+/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

export function resolveSeries(
  series: ChartSeries[],
  theme: ReturnType<typeof chartTheme>,
  palette: string[] = HEALTH_SYNC_PALETTE
): (ChartSeries & { color: string; label: string })[] {
  return series.map((s, idx) => ({
    ...s,
    label: s.label || s.key,
    color: s.color || palette[idx % palette.length] || theme.accent,
  }));
}

export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    return [Math.max(0, min - 1), min, min + 1];
  }
  const span = Math.max(max - min, 1);
  const roughStep = span / count;
  const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const err = roughStep / power;

  let step = power;
  if (err >= 7.5) step = power * 10;
  else if (err >= 3.5) step = power * 5;
  else if (err >= 1.5) step = power * 2;

  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];

  for (let val = start; val <= end + step * 0.01; val += step) {
    ticks.push(Math.round(val * 1e6) / 1e6);
  }

  return ticks.length > 0 ? ticks : [min, max];
}

export function linePath(pts: Point[], curve: ChartCurve = 'smooth'): string {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;

  if (curve === 'linear' || pts.length === 2) {
    return pts.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${x},${y}`).join('');
  }

  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }

  return d;
}

export function createFormatter(
  format: ValueFormat,
  options?: { currency?: string; decimals?: number }
): (v: number) => string {
  if (typeof format === 'function') return format;

  const decimals = options?.decimals ?? 0;
  const curr = options?.currency || 'USD';

  if (format === 'currency') {
    const sym = curr === 'INR' ? '₹' : curr === 'EUR' ? '€' : '$';
    return (v: number) => {
      return `${sym}${v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    };
  }

  if (format === 'percent') {
    return (v: number) => `${v.toFixed(decimals)}%`;
  }

  if (format === 'compact') {
    return (v: number) => {
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
      return String(v);
    };
  }

  return (v: number) => v.toLocaleString('en-US');
}

export function useChartReveal(once = true, animated = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(!animated);

  useEffect(() => {
    if (!animated) {
      setShown(true);
      return;
    }

    const el = ref.current;
    if (!el) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setShown(false);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once, animated]);

  return { ref, shown, still: !animated };
}

export function ChartCard({
  theme,
  title,
  description,
  value,
  delta,
  icon,
  bare,
  children,
  className = '',
}: {
  theme: ReturnType<typeof chartTheme>;
  title?: string;
  description?: string;
  titleSize?: 'sm' | 'md' | 'lg';
  value?: React.ReactNode;
  delta?: number;
  icon?: React.ReactNode;
  radius?: string;
  bare?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (bare) {
    return <div className={`w-full ${className}`}>{children}</div>;
  }

  const isPositiveDelta = typeof delta === 'number' && delta >= 0;

  return (
    <div
      className={`bg-white rounded-2xl p-4 sm:p-6 border border-[#ECEEF2] shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md ${className}`}
    >
      {(title || description || value !== undefined) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && (
              <h3 className="text-sm sm:text-base font-bold text-[#16191E] tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-[#8A909D] font-medium mt-0.5">{description}</p>
            )}

            {value !== undefined && (
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#16191E] tracking-tight">
                  {value}
                </span>

                {typeof delta === 'number' && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isPositiveDelta
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}
                  >
                    <span>{isPositiveDelta ? '↑' : '↓'}</span>
                    <span>{Math.abs(delta).toFixed(1)}%</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {icon && (
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] flex-shrink-0 shadow-2xs">
              {icon}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

export function ChartTooltip({
  open,
  x,
  y,
  width,
  title,
  rows,
  theme,
}: {
  open: boolean;
  x: number;
  y: number;
  width: number;
  title?: string;
  rows: { label: string; value: string; color: string }[];
  theme: ReturnType<typeof chartTheme>;
}) {
  if (!open || !rows.length) return null;

  const tooltipWidth = 140;
  const isRightSide = x + tooltipWidth + 20 > width;
  const leftPos = isRightSide ? x - tooltipWidth - 14 : x + 14;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      className="absolute pointer-events-none z-20 bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-2.5 shadow-xl border border-slate-700/60 text-xs min-w-[130px]"
      style={{
        left: `${leftPos}px`,
        top: `${Math.max(10, y - 25)}px`,
      }}
    >
      {title && (
        <div className="text-[11px] font-bold text-slate-300 border-b border-slate-700 pb-1 mb-1.5">
          {title}
        </div>
      )}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
              <span className="text-slate-300 truncate max-w-[70px]">{r.label}</span>
            </div>
            <span className="font-bold text-white tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function ChartLegend({
  series,
  theme,
  hidden,
  onToggle,
}: {
  series: (ChartSeries & { color: string; label: string })[];
  theme: ReturnType<typeof chartTheme>;
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
      {series.map((s) => {
        const isHidden = hidden.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none transition-all ${
              isHidden ? 'opacity-40 line-through text-[#8A909D]' : 'text-[#16191E] hover:opacity-85'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ChartPattern({
  id,
  color,
  texture = 'dots',
  theme,
}: {
  id: string;
  color: string;
  texture?: 'solid' | 'dots' | 'hatch';
  theme: ReturnType<typeof chartTheme>;
}) {
  if (texture === 'hatch') {
    return (
      <pattern id={id} width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
      </pattern>
    );
  }

  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1.2" fill={color} fillOpacity="0.25" />
      <circle cx="4.5" cy="4.5" r="1.2" fill={color} fillOpacity="0.25" />
    </pattern>
  );
}
