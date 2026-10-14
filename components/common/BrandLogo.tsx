'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HeartPulse } from 'lucide-react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

export function BrandLogo({
  size = 'md',
  showSubtitle = true,
  className = '',
  onClick,
}: BrandLogoProps) {
  const iconSizes = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-11 h-11 rounded-2xl',
    lg: 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl',
  };

  const svgSizes = {
    sm: 'w-4 h-4 stroke-[2.2]',
    md: 'w-6 h-6 stroke-[2.2]',
    lg: 'w-9 h-9 sm:w-11 sm:h-11 stroke-[2.3]',
  };

  const textSizes = {
    sm: 'text-base font-bold',
    md: 'text-xl font-bold',
    lg: 'text-3xl sm:text-4xl font-extrabold',
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center space-x-3 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <motion.div
        whileHover={{ scale: 1.08, rotate: 6 }}
        whileTap={{ scale: 0.95 }}
        className={`${iconSizes[size]} bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-xs flex-shrink-0`}
      >
        <HeartPulse className={svgSizes[size]} />
      </motion.div>
      <div className="flex flex-col">
        <span className={`${textSizes[size]} tracking-tight text-[#16191E]`}>
          Health<span className="text-[#2563EB]">Sync</span>
        </span>
        {showSubtitle && (
          <span className="text-[9px] font-bold tracking-wider text-[#8A909D] uppercase -mt-0.5">
            CLMS Pavilion
          </span>
        )}
      </div>
    </div>
  );
}

export default BrandLogo;
