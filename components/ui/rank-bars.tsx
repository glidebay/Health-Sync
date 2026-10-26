'use client';

/**
 * RankBarChart — horizontal ranking bars: label · bar · value.
 *
 * Answers "who leads, by how much?" in 2 seconds: rows sorted by the caller,
 * bars scaled from zero to the max value of the list (or an explicit
 * maxValue), the hero row highlighted in an accent color with bold text.
 * Leaderboard genre: clean data rows, no chart chrome. Client component only
 * for the viewport-entry animation (IntersectionObserver); rendering itself
 * is plain divs.
 *
 * Props:
 * - items: RankBarItem[] — label, value, optional valueLabel / sub /
 *   highlight / per-row color.
 * - maxValue?: number — scale ceiling (default: max item value).
 * - unit?: string — suffix appended to plain numeric values (e.g. "%").
 * - highlightColor?: string — bar color for highlighted rows
 *   (default: seriesColor(0)).
 */
import { useEffect, useRef, useState } from 'react';

// --- vizcn palette (Health-Sync medical palette) ---
const CATEGORICAL = [
  '#2563EB', // Health-Sync royal blue
  '#3B82F6', // Blue 500
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EC4899', // Rose
  '#8B5CF6', // Purple
  '#64748B', // Slate
  '#94A3B8', // Gray
] as const;

function seriesColor(i: number): string {
  return CATEGORICAL[((i % CATEGORICAL.length) + CATEGORICAL.length) % CATEGORICAL.length];
}
// --- end palette ---

const BAR_DEFAULT = 'var(--vz-axis, #E2E8F0)';

export type RankBarItem = {
  label: string;
  value: number;
  /** value caption (default: the number itself) */
  valueLabel?: string;
  /** muted line under the label: vendor, date, note */
  sub?: string;
  /** hero row — accent bar + bold label */
  highlight?: boolean;
  /** custom series color (per-vendor); highlight wins */
  color?: string;
};

/**
 * Horizontal ranking bars (leaderboard-table genre): label · bar · value.
 * Scale runs from zero to the max value of the list (or maxValue).
 */
export function RankBarChart({
  items,
  maxValue,
  unit = '',
  highlightColor = seriesColor(0),
}: {
  items: RankBarItem[];
  maxValue?: number;
  unit?: string;
  highlightColor?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setEntered(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const max = maxValue ?? Math.max(...items.map((item) => item.value), 1);
  return (
    <div ref={wrapRef} className={`vc-focus space-y-3.5 ${entered ? 'vrb-in' : ''}`}>
      {items.map((item, index) => {
        const width = Math.max(2, Math.round((item.value / max) * 100));
        const color = item.highlight ? highlightColor : (item.color ?? BAR_DEFAULT);
        return (
          <div
            key={item.label}
            className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_80px] sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_90px] items-center gap-3 sm:gap-4"
            style={{ '--i': index } as React.CSSProperties}
          >
            <div className="min-w-0">
              <p
                className={`truncate text-xs sm:text-[13px] leading-snug ${
                  item.highlight
                    ? 'font-bold text-[#16191E]'
                    : 'font-semibold text-[#16191E]'
                }`}
              >
                {item.label}
              </p>
              {item.sub ? (
                <p className="truncate text-[10.5px] leading-tight text-[#8A909D] mt-0.5">
                  {item.sub}
                </p>
              ) : null}
            </div>
            <div
              className="h-[14px] sm:h-[16px] bg-[#F8F9FB] rounded-r-md border border-[#ECEEF2] overflow-hidden"
              title={`${item.label} · ${item.valueLabel ?? item.value}`}
            >
              <div
                className="vrb-bar h-full rounded-r-md"
                style={{
                  width: `${width}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <p
              className={`vrb-val text-right text-xs sm:text-[13px] tabular-nums ${
                item.highlight
                  ? 'font-extrabold text-[#2563EB]'
                  : 'font-semibold text-[#5E6470]'
              }`}
            >
              {item.valueLabel ?? `${item.value.toLocaleString()}${unit}`}
            </p>
          </div>
        );
      })}

      {/* Bars grow from the left on viewport entry, values fade in after; off under prefers-reduced-motion */}
      <style jsx>{`
        .vrb-in .vrb-bar {
          transform-origin: left;
          animation: vrb-grow 0.7s cubic-bezier(0.2, 0.7, 0.3, 1) both;
          animation-delay: calc(var(--i) * 35ms);
        }
        .vrb-in .vrb-val {
          animation: vrb-fade 0.6s cubic-bezier(0.2, 0.7, 0.3, 1) both;
          animation-delay: calc(var(--i) * 35ms + 150ms);
        }
        @keyframes vrb-grow {
          from {
            transform: scaleX(0);
          }
        }
        @keyframes vrb-fade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .vrb-in .vrb-bar,
          .vrb-in .vrb-val {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export default RankBarChart;
