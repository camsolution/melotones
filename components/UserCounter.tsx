'use client';
import { useEffect, useState } from 'react';

interface UserCounterProps {
  animate?: boolean;
}

export default function UserCounter({ animate = true }: UserCounterProps) {
  const [target, setTarget] = useState(0);
  const [count, setCount] = useState(0);
  const duration = 1200;

  useEffect(() => {
    fetch('/api/public-stats').then(res => res.json()).then(data => setTarget(data.totalUsers ?? 0)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!animate) { setCount(target); return; }
    const start = performance.now();
    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [animate, target]);

  return (
    <span className="tabular-nums">
      {count.toLocaleString('fr-FR')}
    </span>
  );
}
