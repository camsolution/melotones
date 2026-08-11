'use client';
import { Session } from '@supabase/supabase-js';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

const APP_SHELL_PREFIXES = [
  '/dashboard', '/create', '/explore', '/history', '/shorts', '/statistiques', '/notes', '/profil', '/songs',
];

export default function AppShell({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const inAppShell = APP_SHELL_PREFIXES.some(p => pathname === p || pathname?.startsWith(p + '/'));

  if (inAppShell) {
    return (
      <div className="md:flex min-h-screen bg-gray-50">
        <Sidebar session={session} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    );
  }

  return (
    <>
      <Navbar session={session} />
      <main className="container mx-auto px-4 py-8 min-h-screen">{children}</main>
      <footer className="text-center text-sm text-gray-400 py-6 border-t border-gray-200">
        © 2025 IziMelo. Fait avec ❤️ pour la musique.
      </footer>
    </>
  );
}
