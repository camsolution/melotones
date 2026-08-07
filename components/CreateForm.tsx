'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';

const occasions = Object.keys(occasionTranslations);
const styles = Object.keys(styleTranslations);

export default function CreateForm() {
  const { lang, t } = useLanguage();
  const [occasion, setOccasion] = useState(occasions[0]);
  const [style, setStyle] = useState(styles[0]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('generating');
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, style, custom_message: message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setStatus('completed');
      router.push(`/songs/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  const getOccasionLabel = (key: string) => occasionTranslations[key]?.[lang] ?? key;
  const getStyleLabel = (key: string) => styleTranslations[key]?.[lang] ?? key;

  return (
    <div className="card max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-gray-800">{t('Créez votre chanson', 'Create your song')}</h1>
      <p className="text-gray-600 mb-6">{t('Remplissez les détails, l’IA compose votre morceau.', 'Fill in the details, AI composes your track.')}</p>

      {process.env.NEXT_PUBLIC_MOCK_AI === 'true' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span><strong>{t('Mode démo :', 'Demo mode:')}</strong> {t('la génération est simulée. Le vrai moteur IA sera bientôt disponible.', 'generation is simulated. The real AI engine will be available soon.')}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Occasion', 'Occasion')}</label>
          <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none">
            {occasions.map(o => <option key={o} value={o}>{getOccasionLabel(o)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Style musical', 'Music style')}</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none">
            {styles.map(s => <option key={s} value={s}>{getStyleLabel(s)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('Message, noms, anecdotes', 'Message, names, anecdotes')}</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none min-h-[120px]" placeholder={t('Ex : Joyeux anniversaire à mon ami DIOULA...', 'E.g. Happy birthday to my friend John...')} required />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={status === 'generating'} className="btn-primary w-full flex items-center justify-center gap-2 text-lg">
          {status === 'generating' ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('Génération en cours...', 'Generating...')}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {t('Générer ma chanson (1 crédit)', 'Generate my song (1 credit)')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
