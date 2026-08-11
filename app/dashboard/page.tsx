'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Compass, Music2, Disc3, Star, ChevronRight, Gift, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { Generation } from '@/types';
import { styleMeta } from '@/lib/styleMeta';
import { styleTranslations } from '@/lib/listTranslations';
import AdSlot from '@/components/AdSlot';

const QUICK_STYLES = ['Afrobeat', 'Amapiano', 'RnB', 'Reggae', 'Cabo'];

const STATUS_STYLES: Record<Generation['status'], string> = {
  completed: 'bg-green-100 text-green-800',
  processing: 'bg-yellow-100 text-yellow-800',
  queued: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-800',
};

export default function DashboardPage() {
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

  const firstName = (user.user_metadata?.full_name?.split(' ')[0]) || user.email.split('@')[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? t('Bonne nuit', 'Good night') : hour < 18 ? t('Bonjour', 'Good morning') : t('Bonsoir', 'Good evening');

  const styleCounts = songs.reduce<Record<string, number>>((acc, s) => {
    acc[s.style] = (acc[s.style] || 0) + 1;
    return acc;
  }, {});
  const favoriteStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favoriteLabel = favoriteStyle ? (styleTranslations[favoriteStyle]?.[lang] ?? favoriteStyle) : '—';

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-8 md:py-10 space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[28px] p-8 md:p-10 bg-gradient-to-br from-stage via-[#241852] to-[#3a1f57] text-white shadow-xl">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-violet-200 bg-white/10 border border-white/10 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t('Studio en direct', 'Live studio')}
          </span>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl mt-4 leading-tight">
            {greeting}, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 text-violet-100/80 max-w-md">
            {t("Un Afrobeat, un Amapiano, une déclaration en Reggae — dites-nous l'occasion, on compose le titre.",
              'An Afrobeat, an Amapiano, a Reggae declaration — tell us the occasion, we compose the track.')}
          </p>

          <div className="flex flex-wrap gap-2 mt-6">
            {QUICK_STYLES.map(key => {
              const meta = styleMeta[key];
              const label = styleTranslations[key]?.[lang] ?? key;
              return (
                <Link
                  key={key}
                  href={`/create?style=${encodeURIComponent(key)}`}
                  className="text-[12.5px] font-bold text-violet-50 bg-white/[.08] border border-white/[.14] px-3.5 py-2 rounded-full hover:bg-white/[.16] hover:border-white/30 transition-colors"
                >
                  {meta?.emoji} {label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Link href="/create" className="inline-flex items-center gap-2 font-extrabold text-[14.5px] px-6 py-3.5 rounded-full text-[#1B0C22] bg-gradient-to-r from-magenta-500 via-[#FF6F61] to-amber-400 shadow-lg shadow-magenta-500/30 hover:-translate-y-0.5 transition-transform">
              <Sparkles className="w-[17px] h-[17px]" /> {t('Composer ma chanson', 'Compose my song')}
            </Link>
            <Link href="/explore" className="inline-flex items-center gap-2 font-extrabold text-[14.5px] px-6 py-3.5 rounded-full text-white bg-white/[.08] border border-white/[.16] hover:bg-white/[.14] transition-colors">
              <Compass className="w-[17px] h-[17px]" /> {t('Explorer les créations', 'Explore creations')}
            </Link>
          </div>
        </section>

        {/* Notes / welcome card */}
        <section className="rounded-[28px] p-6 bg-white border border-gray-200 shadow-xl flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex-none flex items-center justify-center text-white bg-gradient-to-br from-amber-400 to-magenta-500 shadow-lg shadow-magenta-200">
              <Gift className="w-[22px] h-[22px]" strokeWidth={1.9} />
            </div>
            <div>
              <div className="font-display font-bold text-[15.5px] text-gray-800">
                {balance > 0 ? t('Tes Notes', 'Your Notes') : t('Offre de bienvenue', 'Welcome offer')}
              </div>
              <div className="text-[13px] text-gray-500">
                {balance > 0 ? t('Ton solde actuel', 'Your current balance') : t('Prêt·e pour ta première chanson ?', 'Ready for your first song?')}
              </div>
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-display font-extrabold text-4xl text-gray-800 tabular-nums">{balance}</span>
            <span className="text-sm text-gray-500 font-semibold">{t('Note(s) disponible(s)', 'Note(s) available')}</span>
          </div>

          <p className="text-[13px] text-gray-500">
            {balance > 0
              ? t('1 Note = 1 chanson générée. Lance ta prochaine création dès maintenant.', '1 Note = 1 generated song. Start your next creation now.')
              : t('Chaque chanson coûte 1 Note. Achète ton premier pack pour composer ton titre.', 'Each song costs 1 Note. Buy your first pack to compose your track.')}
          </p>

          <Link
            href={balance > 0 ? '/create' : '/notes'}
            className="w-full text-center font-bold text-[14px] py-3 rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
          >
            {balance > 0 ? t('Créer une chanson', 'Create a song') : t('Découvrir les packs de Notes', 'See Notes packs')}
          </Link>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5">
        {/* Recent songs */}
        <section className="lg:order-1 order-2 rounded-[28px] p-7 md:p-8 bg-white border border-gray-200 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-[15.5px] text-gray-800">{t('Chansons récentes', 'Recent songs')}</h2>
            <Link href="/history" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-600 hover:text-brand-700">
              {t('Voir tout', 'View all')} <ChevronRight className="w-[14px] h-[14px]" />
            </Link>
          </div>

          {songs.length === 0 ? (
            <div className="flex flex-wrap items-center gap-7 py-2">
              <div className="w-24 h-24 flex-none rounded-full relative" style={{
                background: 'repeating-radial-gradient(circle at center, #2A1B4B 0 3px, #1B1130 3px 6px)',
                boxShadow: 'inset 0 0 0 1px #E4D9F5',
              }}>
                <div className="absolute inset-0 m-auto w-[34px] h-[34px] rounded-full bg-gradient-to-br from-magenta-500 to-amber-400" />
                <div className="absolute left-1/2 top-1/2 w-[34px] h-[34px] -ml-[17px] -mt-[17px] rounded-full border-[9px] border-white box-border" />
              </div>
              <div className="flex-1 min-w-[220px]">
                <h3 className="font-display font-extrabold text-[18px] text-gray-800">{t('Votre studio est encore silencieux', 'Your studio is still quiet')}</h3>
                <p className="text-[13.5px] text-gray-500 mt-1.5 max-w-md">
                  {t('Aucune chanson pour le moment — composez la première en moins de deux minutes.',
                    'No song yet — compose your first one in under two minutes.')}
                </p>
                <Link href="/create" className="inline-flex items-center gap-2 mt-4 font-bold text-[13.5px] px-5 py-2.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500">
                  <Sparkles className="w-4 h-4" /> {t('Créer ma première chanson', 'Create my first song')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {songs.slice(0, 3).map(song => (
                <Link key={song.id} href={`/songs/${song.id}`} className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/30 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(song.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                    </div>
                    <h3 className="font-semibold text-gray-800 capitalize truncate">{song.occasion} · {song.style}</h3>
                  </div>
                  <span className={`flex-none px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[song.status]}`}>
                    {song.status === 'completed' ? t('Terminé', 'Completed') : song.status === 'processing' ? t('En cours', 'Processing') : song.status === 'queued' ? t('En attente', 'Queued') : t('Échoué', 'Failed')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Stats teaser */}
        <section className="lg:order-2 order-1 rounded-[28px] p-6 bg-white border border-gray-200 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-[15.5px] text-gray-800">{t('Statistiques', 'Statistics')}</h2>
            <Link href="/statistiques" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-600 hover:text-brand-700">
              {t('Détails', 'Details')} <ChevronRight className="w-[14px] h-[14px]" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-brand-500 to-violet-400 mb-2.5"><Disc3 className="w-4 h-4" /></div>
              <div className="font-display font-extrabold text-xl text-gray-800 tabular-nums">{songs.length}</div>
              <div className="text-[11px] text-gray-500 font-semibold mt-0.5">{t('Chansons créées', 'Songs created')}</div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-magenta-500 to-[#FF8FB3] mb-2.5"><Music2 className="w-4 h-4" /></div>
              <div className="font-display font-extrabold text-xl text-gray-800 tabular-nums">{balance}</div>
              <div className="text-[11px] text-gray-500 font-semibold mt-0.5">{t('Solde de Notes', 'Notes balance')}</div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#3A2400] bg-gradient-to-br from-amber-400 to-amber-200 mb-2.5"><Star className="w-4 h-4" /></div>
              <div className="font-display font-extrabold text-xl text-gray-800 truncate">{favoriteLabel}</div>
              <div className="text-[11px] text-gray-500 font-semibold mt-0.5">{t('Genre favori', 'Favorite genre')}</div>
            </div>
          </div>
        </section>
      </div>

      <AdSlot />
    </div>
  );
}
