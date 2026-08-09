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
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-pink-50 opacity-50 -z-10" />
        <h1 className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-brand-600 to-pink-500 text-transparent bg-clip-text mb-6 leading-tight">
          {t('Vos mots, notre IA, une chanson inoubliable', 'Your words, our AI, an unforgettable song')}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          {t('Anniversaires, mariages, baptêmes, hommages… Transformez n’importe quel message en un morceau unique et émouvant.', 'Birthdays, weddings, christenings, tributes… Turn any message into a unique and moving song.')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link href={primaryCtaHref} className="btn-primary text-lg px-8 py-4">{primaryCtaLabel}</Link>
          <Link href="#examples" className="btn-secondary text-lg px-8 py-4">{t('Écouter des exemples', 'Listen to samples')}</Link>
        </div>
        <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
          <span className="text-brand-700 font-bold text-2xl"><UserCounter />+</span>
          <span>{t('utilisateurs nous font déjà confiance', 'users already trust us')}</span>
        </div>
        <div className="mt-3 flex justify-center items-center gap-2 text-sm text-gray-500">
          <span className="flex items-center gap-1"><span className="text-yellow-500">★★★★★</span> 4.9 / 5</span>
          <span>·</span>
          <span>{t('basé sur 2 300 avis', 'based on 2,300 reviews')}</span>
        </div>
      </section>
      <section id="examples" className="py-12">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">{t('Parcourez nos créations', 'Browse our creations')}</h2>
        <SearchFilters />
        {exampleSongs.length > 0 && <CommunitySongs songs={exampleSongs} />}
      </section>
      <Testimonials />
      <section className="py-16 text-center bg-gradient-to-r from-brand-600 to-pink-500 rounded-2xl my-12 px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('Prêt à créer votre chanson personnalisée ?', 'Ready to create your personalized song?')}</h2>
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
