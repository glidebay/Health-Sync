'use client';

import React, { useState, useEffect } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';

interface AnimatedCounterProps {
  target?: number;
  value?: number;
  duration?: number;
}

export function AnimatedCounter({ target, value, duration = 1.6 }: AnimatedCounterProps) {
  const finalTarget = target ?? value ?? 0;
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const controls = animate(count, finalTarget, { duration, ease: 'easeOut' });
    const unsub = rounded.on('change', (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [count, rounded, finalTarget, duration]);

  return <span>{display}</span>;
}

export default AnimatedCounter;
