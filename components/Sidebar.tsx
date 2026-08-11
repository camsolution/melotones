'use client';
import Link from 'next/link';
import { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  Home, Sparkles, Compass, Library, Clapperboard, BarChart3, Music2, User,
  Globe, LogOut, Menu, X, Headphones,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type NavItem = {
  href: string;
  icon: typeof Home;
  fr: string;
  en: string;
  badge?: 'notes' | 'soon';
};

const PRIMARY_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: Home, fr: 'Accueil', en: 'Home' },
  { href: '/create', icon: Sparkles, fr: 'Créer', en: 'Create' },
  { href: '/explore', icon: Compass, fr: 'Explorer', en: 'Explore' },
  { href: '/history', icon: Library, fr: 'Ma Musique', en: 'My Music' },
  { href: '/shorts', icon: Clapperboard, fr: 'Shorts', en: 'Shorts', badge: 'soon' },
  { href: '/statistiques', icon: BarChart3, fr: 'Statistiques', en: 'Stats' },
];

const SECONDARY_ITEMS: NavItem[] = [
  { href: '/notes', icon: Music2, fr: 'Notes', en: 'Notes', badge: 'notes' },
  { href: '/profil', icon: User, fr: 'Profil', en: 'Profile' },
];

export default function Sidebar({ session: initialSession }: { session: Session | null }) {
  const [session, setSession] = useState(initialSession);
  const [balance, setBalance] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session) { setBalance(null); setIsAdmin(false); return; }
    fetch('/api/me').then(res => res.json()).then(data => {
      setBalance(data.balance ?? 0);
      setIsAdmin(!!data.is_admin);
    }).catch(() => {});
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    setMobileOpen(false);
  };

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl font-semibold text-[14.5px] transition-colors ${
          active ? 'text-white bg-gradient-to-r from-brand-500/25 to-magenta-500/15' : 'text-stage-muted hover:text-stage-text hover:bg-white/[.06]'
        }`}
      >
        {active && (
          <span className="absolute -left-5 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-magenta-500 to-amber-500" />
        )}
        <Icon className="w-[19px] h-[19px] flex-none" strokeWidth={1.75} />
        <span className="truncate">{t(item.fr, item.en)}</span>
        {item.badge === 'soon' && (
          <span className="ml-auto text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">
            {t('Bientôt', 'Soon')}
          </span>
        )}
        {item.badge === 'notes' && (
          <span className="ml-auto text-[10px] font-extrabold bg-brand-500/20 text-violet-200 px-1.5 py-0.5 rounded-full tabular-nums">
            {balance ?? '–'}
          </span>
        )}
      </Link>
    );
  };

  const NavContent = (
    <>
      <Link href="/dashboard" className="flex items-center gap-2.5 px-1.5">
        <div className="w-9 h-9 rounded-[11px] flex-none flex items-center justify-center bg-gradient-to-br from-violet-500 via-magenta-500 to-amber-400">
          <Headphones className="w-[18px] h-[18px] text-stage" strokeWidth={2} />
        </div>
        <span className="font-display font-bold text-[16px] tracking-tight text-white">IziMelo</span>
      </Link>

      <nav className="flex flex-col gap-1 mt-2">
        {PRIMARY_ITEMS.map(renderItem)}
        <div className="h-px bg-stage-border my-2 mx-1" />
        {SECONDARY_ITEMS.map(renderItem)}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex bg-white/5 border border-stage-border rounded-full p-[3px] gap-0.5">
          {(['fr', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`flex-1 text-[11.5px] font-extrabold tracking-wide py-1.5 rounded-full transition-colors ${
                lang === l ? 'bg-white/10 text-white' : 'text-stage-muted'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {session && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-white/[.045] border border-stage-border">
            <div className="w-9 h-9 rounded-[11px] flex-none flex items-center justify-center font-display font-bold text-[14px] text-white bg-gradient-to-br from-magenta-500 to-violet-500">
              {session.user.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-white truncate">
                {isAdmin ? t('Administrateur', 'Admin') : t('Mon compte', 'My account')}
              </div>
              <div className="text-[11px] text-stage-muted truncate">{session.user.email}</div>
            </div>
            <button onClick={handleLogout} title={t('Déconnexion', 'Logout')} className="flex-none p-1.5 rounded-lg text-stage-muted hover:text-white hover:bg-white/10 transition-colors">
              <LogOut className="w-[17px] h-[17px]" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail — the "stage": stays dark in both light and dark reading modes */}
      <aside className="hidden md:flex sticky top-0 h-screen w-[264px] flex-none flex-col gap-7 px-5 py-7 bg-gradient-to-b from-stage to-[#130C24] border-r border-stage-border">
        {NavContent}
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 h-16 bg-stage border-b border-stage-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center bg-gradient-to-br from-violet-500 via-magenta-500 to-amber-400">
            <Headphones className="w-[14px] h-[14px] text-stage" strokeWidth={2} />
          </div>
          <span className="font-display font-bold text-[15px] text-white">IziMelo</span>
        </Link>
        <button onClick={() => setMobileOpen(o => !o)} className="p-2 text-stage-text">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-[280px] h-full flex flex-col gap-7 px-5 py-7 pt-20 bg-gradient-to-b from-stage to-[#130C24] border-r border-stage-border overflow-y-auto">
            {NavContent}
          </div>
        </div>
      )}
    </>
  );
}
