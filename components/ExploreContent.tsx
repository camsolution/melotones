'use client';
import Link from 'next/link';
import { ExampleSong } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchFilters from '@/components/SearchFilters';
import CommunitySongs from '@/components/CommunitySongs';
import { Compass, Sparkles } from 'lucide-react';

export default function ExploreContent({ songs }: { songs: ExampleSong[] }) {
  const { t } = useLanguage();
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-2xl flex-none flex items-center justify-center text-white bg-gradient-to-br from-brand-500 to-magenta-500">
          <Compass className="w-5 h-5" strokeWidth={1.9} />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-gray-800">{t('Explorer', 'Explore')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('Écoutez des créations partagées par la communauté.', 'Listen to creations shared by the community.')}</p>
        </div>
      </div>
      <SearchFilters />
      {songs.length > 0 ? (
        <CommunitySongs songs={songs} />
      ) : (
        <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-10 text-center">
          <p className="text-gray-500 mb-4">
            {t('Aucune chanson publique pour le moment — soyez parmi les premiers à partager la vôtre !',
              'No public songs yet — be among the first to share yours!')}
          </p>
          <Link href="/create" className="inline-flex items-center gap-2 font-bold text-[13.5px] px-6 py-3 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500">
            <Sparkles className="w-4 h-4" /> {t('Créer une chanson', 'Create a song')}
          </Link>
        </div>
      )}
    </div>
  );
}
