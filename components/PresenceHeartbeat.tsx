'use client';
import { useEffect } from 'react';

const INTERVAL_MS = 20_000;

export default function PresenceHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, INTERVAL_MS);
    document.addEventListener('visibilitychange', ping);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', ping);
    };
  }, []);

  return null;
}
