'use client';
import { ExampleSong } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchFilters from '@/components/SearchFilters';
import CommunitySongs from '@/components/CommunitySongs';
import { Compass } from 'lucide-react';

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
        <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-10 text-center text-gray-500">
          {t('Aucune création ne correspond à ta recherche pour le moment.', 'No creation matches your search yet.')}
        </div>
      )}
    </div>
  );
}
