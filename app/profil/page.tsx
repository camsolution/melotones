'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, LogOut, ShieldCheck, Music2, Calendar } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';

export default function ProfilPage() {
  const { lang, setLang, t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login');
      else setUser(user);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/me').then(res => res.json()).then(data => {
      setBalance(data.balance ?? 0);
      setIsAdmin(!!data.is_admin);
    }).catch(() => {});
  }, [user]);

  if (!user) return null;

  const fullName = user.user_metadata?.full_name;
  const memberSince = new Date(user.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long' });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-2xl flex-none flex items-center justify-center text-white bg-gradient-to-br from-brand-500 to-magenta-500">
          <User className="w-5 h-5" strokeWidth={1.9} />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-gray-800">{t('Profil', 'Profile')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('Tes informations de compte.', 'Your account information.')}</p>
        </div>
      </div>

      <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-7 flex items-center gap-4 mb-5">
        <div className="w-16 h-16 rounded-2xl flex-none flex items-center justify-center font-display font-bold text-2xl text-white bg-gradient-to-br from-magenta-500 to-violet-500">
          {(fullName || user.email)[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-display font-bold text-lg text-gray-800 truncate">{fullName || t('Mon compte', 'My account')}</div>
          <div className="text-sm text-gray-500 truncate">{user.email}</div>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" /> {t('Administrateur', 'Admin')}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400 flex-none" />
          <div>
            <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">{t('Membre depuis', 'Member since')}</div>
            <div className="text-sm font-semibold text-gray-800 capitalize">{memberSince}</div>
          </div>
        </div>
        <Link href="/notes" className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 flex items-center gap-3 hover:border-brand-200 transition-colors">
          <Music2 className="w-5 h-5 text-gray-400 flex-none" />
          <div>
            <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">{t('Solde de Chansons', 'Songs balance')}</div>
            <div className="text-sm font-semibold text-gray-800 tabular-nums">{balance}</div>
          </div>
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 mb-5">
        <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-3">{t('Langue', 'Language')}</div>
        <div className="flex bg-gray-100 rounded-full p-1 gap-1 w-fit">
          {(['fr', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold transition-colors ${lang === l ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
            >
              {l === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 font-bold text-[13.5px] py-3 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
        <LogOut className="w-4 h-4" /> {t('Déconnexion', 'Logout')}
      </button>
    </div>
  );
}
