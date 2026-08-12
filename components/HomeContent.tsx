'use client';
import Link from 'next/link';
import CommunitySongs from '@/components/CommunitySongs';
import SearchFilters from '@/components/SearchFilters';
import Testimonials from '@/components/Testimonials';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExampleSong } from '@/types';
import { PublicTestimonial } from '@/lib/testimonials';

// Rendu uniquement pour les visiteurs non connectés — app/page.tsx redirige
// déjà toute session active vers /dashboard avant d'arriver ici.
export default function HomeContent({ exampleSongs, testimonials }: { exampleSongs: ExampleSong[]; testimonials: PublicTestimonial[] }) {
  const { t } = useLanguage();

  return (
    <div>
      <section className="text-center py-16 md:py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-amber-50 opacity-70 -z-10" />
        <h1 className="font-display text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-brand-600 via-magenta-500 to-amber-500 text-transparent bg-clip-text mb-6 leading-tight text-balance">
          {t('Bienvenue sur Melotones', 'Welcome to Melotones')}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          {t(
            "L'application qui transforme vos messages en chansons personnalisées uniques grâce à l'IA. Que ce soit pour un anniversaire, un mariage, ou juste pour faire plaisir à votre famille et vos amis.",
            'The app that turns your messages into unique personalized songs powered by AI. Whether for a birthday, a wedding, or just to make your family and friends smile.'
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link href="/signup" className="btn-primary text-lg px-8 py-4">{t('Essayer maintenant', 'Try now')}</Link>
          <Link href="/login" className="btn-secondary text-lg px-8 py-4">{t('Se connecter', 'Log in')}</Link>
        </div>
      </section>
      {exampleSongs.length > 0 && (
        <section id="examples" className="py-12">
          <h2 className="font-display text-3xl font-bold mb-6 text-gray-800">{t('Parcourez nos créations', 'Browse our creations')}</h2>
          <SearchFilters />
          <CommunitySongs songs={exampleSongs} />
        </section>
      )}
      <Testimonials testimonials={testimonials} />
    </div>
  );
}
