'use client';

import React from 'react';
import { RankBarChart } from '@/components/ui/rank-bars';

export default function RankBarsDemo() {
  return (
    <div className="mx-auto w-full max-w-[560px]">
      <p className="mb-4 text-[13px] font-semibold text-[#16191E]">
        Coding benchmark · pass rate, Jun 2026
      </p>
      <RankBarChart
        unit="%"
        items={[
          { label: 'Atlas 4', sub: 'Meridian', value: 74.2, highlight: true },
          { label: 'Nova Max', sub: 'Helix Labs', value: 68.9 },
          { label: 'Orion Pro', sub: 'Vantage', value: 63.5 },
          { label: 'Vega 2', sub: 'Meridian', value: 57.1 },
          { label: 'Lumen', sub: 'Helix Labs', value: 44.8 },
        ]}
      />
    </div>
  );
}
