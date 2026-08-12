'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Music2, Infinity as InfinityIcon } from 'lucide-react';
import CreditsManager from '@/components/CreditsManager';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';

export default function NotesPage() {
  const { t } = useLanguage();
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
    supabase.from('user_credits').select('balance, is_admin').eq('user_id', user.id).single()
      .then(({ data }) => { setBalance(data?.balance ?? 0); setIsAdmin(data?.is_admin === true); });
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl flex-none flex items-center justify-center text-white bg-gradient-to-br from-magenta-500 to-amber-400">
          <Music2 className="w-5 h-5" strokeWidth={1.9} />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-gray-800">{t('Chansons', 'Songs')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('1 Chanson = 1 titre généré.', '1 Song = 1 generated track.')}</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-8 my-6 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white bg-gradient-to-br from-brand-600 to-magenta-500">
            <InfinityIcon className="w-7 h-7" strokeWidth={1.9} />
          </div>
          <p className="font-display font-extrabold text-2xl text-gray-800 mb-2">{t('Génération illimitée', 'Unlimited generation')}</p>
          <p className="text-gray-500 text-[15px]">
            {t('Votre compte administrateur génère autant de chansons que vous voulez, sans rien débiter de votre solde — aucun achat n\'est nécessaire.', 'Your admin account generates as many songs as you want, without debiting your balance — no purchase needed.')}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-8 my-6 flex items-baseline gap-2">
            <span className="font-display font-extrabold text-5xl text-gray-800 tabular-nums">{balance}</span>
            <span className="text-gray-500 font-semibold">{t('Chanson(s) disponible(s)', 'Song(s) available')}</span>
          </div>

          <h2 className="font-display font-bold text-[15px] text-gray-800 mb-4">{t('Acheter des Chansons', 'Buy Songs')}</h2>
          <CreditsManager />
        </>
      )}
    </div>
  );
}
