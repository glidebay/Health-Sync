'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedProgressProps {
  percent: number;
  delay?: number;
  className?: string;
}

export function AnimatedProgress({ percent, delay = 0, className = '' }: AnimatedProgressProps) {
  return (
    <div className={`h-2 bg-[#EBECEF] rounded-full overflow-hidden flex ${className ? className : 'w-20 sm:w-28 md:w-32 flex-shrink-0'}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ delay: delay + 0.3, duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-[#2563EB] h-full rounded-full"
      />
    </div>
  );
}

export default AnimatedProgress;
