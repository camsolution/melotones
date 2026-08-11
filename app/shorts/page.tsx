'use client';
import Link from 'next/link';
import { Clapperboard, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ShortsPage() {
  const { t } = useLanguage();
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-16 md:py-24 text-center flex flex-col items-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br from-brand-500 to-magenta-500 mb-6">
        <Clapperboard className="w-7 h-7" strokeWidth={1.9} />
      </div>
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-amber-600 bg-amber-50 px-3 py-1 rounded-full mb-4">
        {t('Bientôt disponible', 'Coming soon')}
      </span>
      <h1 className="font-display font-extrabold text-2xl md:text-3xl text-gray-800 mb-3">{t('Shorts', 'Shorts')}</h1>
      <p className="text-gray-500 max-w-md mb-8">
        {t('Bientôt : transforme tes chansons en clips courts, prêts à partager. On y travaille.',
          'Coming soon: turn your songs into short, shareable clips. We\'re working on it.')}
      </p>
      <Link href="/create" className="inline-flex items-center gap-2 font-bold text-[13.5px] px-6 py-3 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500">
        <Sparkles className="w-4 h-4" /> {t('Créer une chanson en attendant', 'Create a song meanwhile')}
      </Link>
    </div>
  );
}
