'use client';
import { Session } from '@supabase/supabase-js';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import PresenceHeartbeat from '@/components/PresenceHeartbeat';
import ChatWidget from '@/components/ChatWidget';
import PageViewTracker from '@/components/PageViewTracker';

const APP_SHELL_PREFIXES = [
  '/dashboard', '/create', '/explore', '/history', '/shorts', '/statistiques', '/notes', '/profil', '/songs',
];

const BARE_PREFIXES = ['/login', '/signup'];

export default function AppShell({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const inAppShell = APP_SHELL_PREFIXES.some(p => pathname === p || pathname?.startsWith(p + '/'));
  const isBare = BARE_PREFIXES.some(p => pathname === p || pathname?.startsWith(p + '/'));
  const inAdmin = pathname?.startsWith('/admin');
  const tracker = !inAdmin ? <PageViewTracker /> : null;

  if (inAppShell) {
    return (
      <div className="md:flex min-h-screen bg-gray-50">
        {tracker}
        <PresenceHeartbeat />
        <Sidebar session={session} />
        <LanguageSwitcher className="hidden md:flex fixed top-5 right-6 z-40" />
        <main className="flex-1 min-w-0">{children}</main>
        <ChatWidget />
      </div>
    );
  }

  if (isBare) {
    return (
      <main className="min-h-screen bg-gray-50">
        {tracker}
        {children}
      </main>
    );
  }

  return (
    <>
      {tracker}
      <Navbar session={session} />
      <main className="container mx-auto px-4 py-8 min-h-screen">{children}</main>
      <footer className="text-center text-sm text-gray-400 py-6 border-t border-gray-200">
        <div className="flex justify-center gap-5 mb-3 text-xs font-medium">
          <a href="https://www.tiktok.com/@melotones?lang=fr" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 transition-colors">TikTok</a>
          <a href="https://www.instagram.com/melotones913/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 transition-colors">Instagram</a>
          <a href="https://web.facebook.com/profile.php?id=61593188100817" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 transition-colors">Facebook</a>
          <a href="https://www.youtube.com/channel/UCCWzKz5_iUpDhUYtQ4PmFSg" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 transition-colors">YouTube</a>
        </div>
        © {new Date().getFullYear()} Melotones. Fait avec ❤️ pour la musique.
      </footer>
    </>
  );
}
