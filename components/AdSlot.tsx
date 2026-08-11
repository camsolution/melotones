'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

type Ad = {
  id: string;
  advertiser_name: string;
  media_url: string;
  media_type: 'image' | 'video';
  target_url: string | null;
};

export default function AdSlot() {
  const { t } = useLanguage();
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    fetch('/api/ads')
      .then((r) => r.json())
      .then((ads: Ad[]) => {
        if (ads.length > 0) setAd(ads[Math.floor(Math.random() * ads.length)]);
      })
      .catch(() => {});
  }, []);

  if (!ad) return null;

  const content = (
    <div className="relative rounded-[24px] overflow-hidden border border-gray-200 shadow-sm group">
      <span className="absolute top-3 left-3 z-10 text-[10px] font-bold uppercase tracking-wide text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
        {t('Sponsorisé', 'Sponsored')}
      </span>
      {ad.media_type === 'video' ? (
        <video src={ad.media_url} autoPlay muted loop playsInline className="w-full max-h-40 object-cover" />
      ) : (
        <img src={ad.media_url} alt={ad.advertiser_name} className="w-full max-h-40 object-cover" />
      )}
    </div>
  );

  if (!ad.target_url) return content;

  return (
    <a href={ad.target_url} target="_blank" rel="noopener noreferrer sponsored" className="block">
      {content}
    </a>
  );
}
