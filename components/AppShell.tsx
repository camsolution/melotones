'use client';
import { Session } from '@supabase/supabase-js';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PresenceHeartbeat from '@/components/PresenceHeartbeat';

const APP_SHELL_PREFIXES = [
  '/dashboard', '/create', '/explore', '/history', '/shorts', '/statistiques', '/notes', '/profil', '/songs',
];

const BARE_PREFIXES = ['/login', '/signup'];

export default function AppShell({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const inAppShell = APP_SHELL_PREFIXES.some(p => pathname === p || pathname?.startsWith(p + '/'));
  const isBare = BARE_PREFIXES.some(p => pathname === p || pathname?.startsWith(p + '/'));

  if (inAppShell) {
    return (
      <div className="md:flex min-h-screen bg-gray-50">
        <PresenceHeartbeat />
        <Sidebar session={session} />
        <LanguageSwitcher className="hidden md:flex fixed top-5 right-6 z-40" />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    );
  }

  if (isBare) {
    return <main className="min-h-screen bg-gray-50">{children}</main>;
  }

  return (
    <>
      <Navbar session={session} />
      <main className="container mx-auto px-4 py-8 min-h-screen">{children}</main>
      <footer className="text-center text-sm text-gray-400 py-6 border-t border-gray-200">
        © 2025 Melotones. Fait avec ❤️ pour la musique.
      </footer>
    </>
  );
}
