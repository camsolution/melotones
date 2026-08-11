'use client';
import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';
import { styleMeta } from '@/lib/styleMeta';

type Featured = {
  id: string;
  occasion: string;
  style: string;
  audio_url: string;
  cover_url: string | null;
};

export default function FeaturedSong() {
  const { lang, t } = useLanguage();
  const [song, setSong] = useState<Featured | null>(null);

  useEffect(() => {
    fetch('/api/featured-song')
      .then((r) => r.json())
      .then((s) => setSong(s))
      .catch(() => {});
  }, []);

  if (!song) return null;

  const occasionLabel = occasionTranslations[song.occasion]?.[lang] ?? song.occasion;
  const styleLabel = styleTranslations[song.style]?.[lang] ?? song.style;
  const gradient = styleMeta[song.style]?.gradient ?? 'from-brand-500 to-magenta-500';

  return (
    <section className="rounded-[28px] p-6 bg-white border border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-4 h-4 text-brand-600" />
        <h2 className="font-display font-bold text-[15.5px] text-gray-800">{t('Chanson en vedette', 'Featured song')}</h2>
      </div>

      <div className="flex items-center gap-4">
        {song.cover_url ? (
          <img src={song.cover_url} alt="" className="w-16 h-16 rounded-2xl object-cover flex-none shadow-sm" />
        ) : (
          <div className={`w-16 h-16 rounded-2xl flex-none bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl`}>
            {styleMeta[song.style]?.emoji ?? '🎵'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-gray-800 truncate capitalize">{occasionLabel}</p>
          <p className="text-[12.5px] text-gray-500 truncate">{styleLabel}</p>
        </div>
      </div>

      <audio controls src={song.audio_url} className="w-full mt-4 h-9" />
    </section>
  );
}
