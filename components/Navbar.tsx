'use client';
import Link from 'next/link';
import { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Menu, X, Music, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Navbar({ session: initialSession }: { session: Session | null }) {
  const [session, setSession] = useState(initialSession);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);
  const toggleLang = () => setLang(lang === 'fr' ? 'en' : 'fr');

  return (
    <nav className="sticky top-0 z-50 glass-nav">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-pink-500" onClick={closeMobile}>
          <Music className="w-7 h-7 text-brand-600" />
          Melotones
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-gray-700 hover:text-brand-600 transition-colors font-medium">{t('Accueil', 'Home')}</Link>
          {session ? (
            <>
              <Link href="/create" className="text-gray-700 hover:text-brand-600 transition-colors font-medium">{t('Créer', 'Create')}</Link>
              <Link href="/history" className="text-gray-700 hover:text-brand-600 transition-colors font-medium">{t('Mes sons', 'My Songs')}</Link>
              <Link href="/dashboard" className="text-gray-700 hover:text-brand-600 transition-colors font-medium">{t('Dashboard', 'Dashboard')}</Link>
              <button onClick={handleLogout} className="btn-secondary text-sm">{t('Déconnexion', 'Logout')}</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary text-sm">{t('Connexion', 'Login')}</Link>
              <Link href="/signup" className="btn-primary text-sm">{t('Essayer gratuitement', 'Try for free')}</Link>
            </>
          )}
          <button onClick={toggleLang} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors ml-4" title={t('Passer en anglais', 'Switch to French')}>
            <Globe className="w-4 h-4" />
            {lang === 'fr' ? 'FR' : 'EN'}
          </button>
        </div>

        {/* Mobile */}
        <div className="md:hidden flex items-center gap-2">
          <button onClick={toggleLang} className="p-2 text-gray-600">
            <Globe className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-600" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-4 space-y-3">
          <Link href="/" onClick={closeMobile} className="block text-gray-700 font-medium">{t('Accueil', 'Home')}</Link>
          {session ? (
            <>
              <Link href="/create" onClick={closeMobile} className="block text-gray-700 font-medium">{t('Créer', 'Create')}</Link>
              <Link href="/history" onClick={closeMobile} className="block text-gray-700 font-medium">{t('Mes sons', 'My Songs')}</Link>
              <Link href="/dashboard" onClick={closeMobile} className="block text-gray-700 font-medium">{t('Dashboard', 'Dashboard')}</Link>
              <button onClick={handleLogout} className="w-full btn-secondary">{t('Déconnexion', 'Logout')}</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={closeMobile} className="block w-full btn-secondary text-center">{t('Connexion', 'Login')}</Link>
              <Link href="/signup" onClick={closeMobile} className="block w-full btn-primary text-center">{t('Essayer gratuitement', 'Try for free')}</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
