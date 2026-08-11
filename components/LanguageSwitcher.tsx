'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  return (
    <div className={`flex bg-white border border-gray-200 rounded-full p-1 gap-0.5 shadow-sm ${className}`}>
      {(['fr', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-label={l === 'fr' ? 'Français' : 'English'}
          aria-pressed={lang === l}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-colors ${
            lang === l ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span aria-hidden>{l === 'fr' ? '🇫🇷' : '🇺🇸'}</span> {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
