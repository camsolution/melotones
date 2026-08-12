'use client';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import UserCounter from '@/components/UserCounter';
import Testimonials from '@/components/Testimonials';
import CommunitySongs from '@/components/CommunitySongs';
import SearchFilters from '@/components/SearchFilters';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExampleSong } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';

export default function HomeContent({ exampleSongs }: { exampleSongs: ExampleSong[] }) {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [supabase]);

  const primaryCtaHref = session ? '/create' : '/signup';
  const primaryCtaLabel = session
    ? t('Créer une chanson', 'Create a song')
    : t('Essayez gratuitement', 'Try for free');

  return (
    <div>
      <section className="text-center py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-amber-50 opacity-70 -z-10" />
        <h1 className="font-display text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 text-transparent bg-clip-text mb-6 leading-tight text-balance">
          {t('Racontez votre histoire, Melotones en fait une chanson', 'Tell your story, Melotones turns it into a song')}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          {t('Choisissez une occasion, écrivez quelques mots, sélectionnez un style africain ou international — l’IA compose une chanson unique, prête à offrir.', 'Pick an occasion, write a few words, choose an African or international style — the AI composes a unique song, ready to give.')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link href={primaryCtaHref} className="btn-primary text-lg px-8 py-4">{primaryCtaLabel}</Link>
          <Link href="#examples" className="btn-secondary text-lg px-8 py-4">{t('Écouter des exemples', 'Listen to samples')}</Link>
        </div>
        <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
          <span className="text-brand-700 font-bold text-2xl"><UserCounter /></span>
          <span>{t('utilisateurs nous font déjà confiance', 'users already trust us')}</span>
        </div>
      </section>
      <section id="examples" className="py-12">
        <h2 className="font-display text-3xl font-bold mb-6 text-gray-800">{t('Parcourez nos créations', 'Browse our creations')}</h2>
        <SearchFilters />
        {exampleSongs.length > 0 && <CommunitySongs songs={exampleSongs} />}
      </section>
      <Testimonials />
      <section className="py-16 text-center bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 rounded-[28px] my-12 px-6">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t('Prêt à créer votre chanson personnalisée ?', 'Ready to create your personalized song?')}</h2>
        <p className="text-white/80 mb-8 max-w-xl mx-auto">
          {t('Rejoignez plus de', 'Join over')}{' '}
          <strong className="text-white"><UserCounter animate={false} /></strong>{' '}
          {t('utilisateurs et offrez un cadeau musical unique.', 'users and give a unique musical gift.')}
        </p>
        <Link href="/create" className="inline-block bg-white text-brand-700 font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200">{t('Commencer maintenant', 'Start now')}</Link>
      </section>
    </div>
  );
}
