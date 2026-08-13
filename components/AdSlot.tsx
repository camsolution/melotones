'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type Ad = {
  id: string;
  advertiser_name: string;
  media_url: string;
  media_type: 'image' | 'video';
  target_url: string | null;
};

export default function AdSlot({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const [ad, setAd] = useState<Ad | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch('/api/ads')
      .then((r) => r.json())
      .then((ads: Ad[]) => {
        if (ads.length > 0) setAd(ads[Math.floor(Math.random() * ads.length)]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ad || ad.media_type !== 'video' || !videoRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) videoRef.current.pause();
  }, [ad]);

  if (!ad) return null;

  const height = compact ? 'h-28' : 'h-40 sm:h-48';

  const content = (
    <div className={`relative ${compact ? 'rounded-[24px]' : 'rounded-[28px]'} overflow-hidden border border-gray-200 shadow-sm group-hover:shadow-lg group-hover:border-brand-200 transition-all duration-300`}>
      {ad.media_type === 'video' ? (
        <video
          ref={videoRef}
          src={ad.media_url}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className={`w-full ${height} object-cover transition-transform duration-500 group-hover:scale-[1.03]`}
        />
      ) : (
        <img decoding="async" loading="lazy"
          src={ad.media_url}
          alt={ad.advertiser_name}
          className={`w-full ${height} object-cover transition-transform duration-500 group-hover:scale-[1.03]`}
        />
      )}

      {/* Voile bas pour la lisibilité du texte, quel que soit le visuel */}
      <div className={`absolute inset-x-0 bottom-0 ${compact ? 'h-14' : 'h-20'} bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none`} />

      <span className={`absolute top-2.5 left-2.5 text-[9px] font-bold uppercase tracking-wide text-white/90 bg-black/35 backdrop-blur-sm px-2 py-0.5 rounded-full`}>
        {t('Sponsorisé', 'Sponsored')}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
        <span className={`text-white font-display font-bold ${compact ? 'text-[12.5px]' : 'text-[14.5px]'} truncate drop-shadow-sm`}>
          {ad.advertiser_name}
        </span>
        {ad.target_url && (
          <span className={`flex-none inline-flex items-center gap-1 ${compact ? 'text-[10.5px] px-2 py-1' : 'text-[12px] px-3 py-1.5'} font-bold text-[#1B0C22] bg-white rounded-full shadow-sm group-hover:bg-amber-300 transition-colors`}>
            {t('Découvrir', 'Discover')} <ArrowUpRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </div>
  );

  if (!ad.target_url) return <div className="group">{content}</div>;

  return (
    <a
      href={ad.target_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-[28px]"
      aria-label={`${t('Publicité', 'Advertisement')} — ${ad.advertiser_name}`}
    >
      {content}
    </a>
  );
}
