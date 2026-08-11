'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Disc3, Music2, Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { Generation } from '@/types';
import { styleMeta } from '@/lib/styleMeta';
import { styleTranslations, occasionTranslations } from '@/lib/listTranslations';

export default function StatistiquesPage() {
  const { lang, t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [songs, setSongs] = useState<Generation[]>([]);
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
    supabase.from('user_credits').select('balance').eq('user_id', user.id).single()
      .then(({ data }) => setBalance(data?.balance ?? 0));
    supabase.from('generations').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setSongs(data || []));
  }, [user]);

  if (!user) return null;

  const styleCounts = songs.reduce<Record<string, number>>((acc, s) => {
    acc[s.style] = (acc[s.style] || 0) + 1;
    return acc;
  }, {});
  const occasionCounts = songs.reduce<Record<string, number>>((acc, s) => {
    acc[s.occasion] = (acc[s.occasion] || 0) + 1;
    return acc;
  }, {});
  const sortedStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]);
  const sortedOccasions = Object.entries(occasionCounts).sort((a, b) => b[1] - a[1]);
  const favoriteLabel = sortedStyles[0] ? (styleTranslations[sortedStyles[0][0]]?.[lang] ?? sortedStyles[0][0]) : '—';
  const completedCount = songs.filter(s => s.status === 'completed').length;

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-10 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-2xl flex-none flex items-center justify-center text-white bg-gradient-to-br from-brand-500 to-violet-400">
          <BarChart3 className="w-5 h-5" strokeWidth={1.9} />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-gray-800">{t('Statistiques', 'Statistics')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('Un aperçu de ton activité musicale.', 'An overview of your musical activity.')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-[24px] border border-gray-200 bg-white shadow-xl p-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-brand-500 to-violet-400 mb-3"><Disc3 className="w-5 h-5" /></div>
          <div className="font-display font-extrabold text-3xl text-gray-800 tabular-nums">{songs.length}</div>
          <div className="text-[12.5px] text-gray-500 font-semibold mt-1">{t('Chansons créées', 'Songs created')}</div>
          {songs.length > 0 && <div className="text-[11px] text-gray-400 mt-1">{completedCount} {t('terminées', 'completed')}</div>}
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white shadow-xl p-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-magenta-500 to-[#FF8FB3] mb-3"><Music2 className="w-5 h-5" /></div>
          <div className="font-display font-extrabold text-3xl text-gray-800 tabular-nums">{balance}</div>
          <div className="text-[12.5px] text-gray-500 font-semibold mt-1">{t('Solde de Notes', 'Notes balance')}</div>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white shadow-xl p-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[#3A2400] bg-gradient-to-br from-amber-400 to-amber-200 mb-3"><Star className="w-5 h-5" /></div>
          <div className="font-display font-extrabold text-3xl text-gray-800 truncate">{favoriteLabel}</div>
          <div className="text-[12.5px] text-gray-500 font-semibold mt-1">{t('Genre favori', 'Favorite genre')}</div>
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-10 text-center text-gray-500">
          {t('Crée ta première chanson pour voir tes statistiques.', 'Create your first song to see your stats.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-[24px] border border-gray-200 bg-white shadow-xl p-6">
            <h2 className="font-display font-bold text-[14.5px] text-gray-800 mb-4">{t('Par style', 'By style')}</h2>
            <div className="space-y-3">
              {sortedStyles.map(([style, count]) => (
                <div key={style}>
                  <div className="flex items-center justify-between text-[12.5px] font-semibold text-gray-600 mb-1">
                    <span>{styleMeta[style]?.emoji} {styleTranslations[style]?.[lang] ?? style}</span>
                    <span className="tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${styleMeta[style]?.gradient ?? 'from-brand-500 to-magenta-500'}`} style={{ width: `${(count / songs.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-gray-200 bg-white shadow-xl p-6">
            <h2 className="font-display font-bold text-[14.5px] text-gray-800 mb-4">{t('Par occasion', 'By occasion')}</h2>
            <div className="space-y-3">
              {sortedOccasions.map(([occasion, count]) => (
                <div key={occasion}>
                  <div className="flex items-center justify-between text-[12.5px] font-semibold text-gray-600 mb-1">
                    <span className="capitalize">{occasionTranslations[occasion]?.[lang] ?? occasion}</span>
                    <span className="tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-magenta-500" style={{ width: `${(count / songs.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
