'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'melotones_session_id';

export function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// Suivi de visite minimal, première partie — voir app/api/track/route.ts.
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // window.location.search plutot que useSearchParams() : evite d'exiger
    // une limite Suspense autour de ce composant pour un simple ajout de
    // parametres UTM a un tracking deja purement client-side.
    const fullPath = pathname + (typeof window !== 'undefined' ? window.location.search : '');
    if (lastSent.current === fullPath) return;
    lastSent.current = fullPath;
    const sessionId = getOrCreateSessionId();
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, path: fullPath }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
