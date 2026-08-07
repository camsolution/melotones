'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';

const occasions = Object.keys(occasionTranslations);
const styles = Object.keys(styleTranslations);

export default function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [occasion, setOccasion] = useState(searchParams.get('occasion') || '');
  const [style, setStyle] = useState(searchParams.get('style') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const { lang, t } = useLanguage();

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (occasion) params.set('occasion', occasion);
    if (style) params.set('style', style);
    if (q) params.set('q', q);
    router.push(`/?${params.toString()}`);
  };

  const getOccasionLabel = (key: string) => occasionTranslations[key]?.[lang] ?? key;
  const getStyleLabel = (key: string) => styleTranslations[key]?.[lang] ?? key;

  return (
    <div className="card mb-8 flex flex-wrap items-end gap-4">
      <div className="flex-1 min-w-[200px]">
        <label className="text-sm font-medium text-gray-600 mb-1 block">{t('Recherche', 'Search')}</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input type="text" placeholder={t('Titre...', 'Title...')} value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 focus:border-brand-300 outline-none transition" />
        </div>
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="text-sm font-medium text-gray-600 mb-1 block">{t('Occasion', 'Occasion')}</label>
        <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="w-full py-2.5 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none">
          <option value="">{t('Toutes', 'All')}</option>
          {occasions.map(o => <option key={o} value={o}>{getOccasionLabel(o)}</option>)}
        </select>
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="text-sm font-medium text-gray-600 mb-1 block">{t('Style', 'Style')}</label>
        <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full py-2.5 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none">
          <option value="">{t('Tous', 'All')}</option>
          {styles.map(s => <option key={s} value={s}>{getStyleLabel(s)}</option>)}
        </select>
      </div>
      <button onClick={applyFilters} className="btn-primary flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4" />
        {t('Filtrer', 'Filter')}
      </button>
    </div>
  );
}
