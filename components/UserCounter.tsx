'use client';
import { useEffect, useState, useRef } from 'react';

interface UserCounterProps {
  animate?: boolean;
}

export default function UserCounter({ animate = true }: UserCounterProps) {
  const [count, setCount] = useState(animate ? 0 : 179900);
  const target = 179900;
  const duration = 2000;

  useEffect(() => {
    if (!animate) return;
    const start = performance.now();
    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [animate]);

  return (
    <span className="tabular-nums">
      {count.toLocaleString('fr-FR')}
    </span>
  );
}
