'use client';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, AlertTriangle, Mic, MicOff, Wand2, ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';
import { styleMeta } from '@/lib/styleMeta';
import { occasionMeta } from '@/lib/occasionMeta';
import { Pack } from '@/lib/pricing';

const genderMeta: Record<Gender, { emoji: string; fr: string; en: string }> = {
  male: { emoji: '👨', fr: 'Homme', en: 'Male' },
  female: { emoji: '👩', fr: 'Femme', en: 'Female' },
  duet: { emoji: '👫', fr: 'Duo', en: 'Duet' },
};

const occasions = Object.keys(occasionTranslations);
const styles = Object.keys(styleTranslations);

type Gender = 'male' | 'female' | 'duet';
const STEPS = ['occasion', 'style', 'voice', 'message', 'review'] as const;
type Step = typeof STEPS[number];

export default function CreateForm() {
  const { lang, t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lyricLoading, setLyricLoading] = useState(false);
  const [packs, setPacks] = useState<Pack[]>([]);
  const recognitionRef = useRef<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const step = STEPS[stepIndex];

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => setBalance(d.balance ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    const preselected = searchParams.get('style');
    if (preselected && styles.includes(preselected)) setStyle(preselected);
  }, []);

  useEffect(() => {
    if (balance !== null && balance < 1 && packs.length === 0) {
      fetch('/api/pricing').then(r => r.json()).then(setPacks).catch(() => {});
    }
  }, [balance]);

  const getOccasionLabel = (key: string) => occasionTranslations[key]?.[lang] ?? key;
  const getStyleLabel = (key: string) => styleTranslations[key]?.[lang] ?? key;

  const goNext = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('La dictée vocale n\'est pas supportée sur ce navigateur.', 'Voice dictation is not supported on this browser.'));
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join(' ');
      setMessage(prev => (prev ? prev + ' ' : '') + transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const handleGenerateLyrics = async () => {
    if (!occasion || !style) return;
    setLyricLoading(true);
    try {
      const res = await fetch('/api/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, style, hint: message }),
      });
      const data = await res.json();
      if (res.ok && data.text) setMessage(data.text);
      else alert(data.error || t('Erreur du générateur de paroles.', 'Lyric generator error.'));
    } catch {
      alert(t('Erreur réseau.', 'Network error.'));
    } finally {
      setLyricLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!occasion || !style || !message) return;
    setStatus('generating');
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, style, custom_message: message, voice_gender: gender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      router.push(`/songs/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="card max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-brand-600' : 'bg-gray-200'}`} />
        ))}
      </div>

      {process.env.NEXT_PUBLIC_MOCK_AI === 'true' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span><strong>{t('Mode démo :', 'Demo mode:')}</strong> {t('génération simulée.', 'simulated generation.')}</span>
        </div>
      )}

      {step === 'occasion' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{t('Pour quelle occasion ?', 'For what occasion?')}</h2>
          <p className="text-gray-500 mb-6">{t('Choisis le moment que tu veux célébrer', 'Choose the moment you want to celebrate')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {occasions.map(o => (
              <button key={o} onClick={() => setOccasion(o)} className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all ${occasion === o ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-200'}`}>
                <span className="text-3xl">{occasionMeta[o]}</span>
                <span className="text-sm font-medium text-gray-700">{getOccasionLabel(o)}</span>
              </button>
            ))}
          </div>
          <button onClick={goNext} disabled={!occasion} className="btn-primary w-full">{t('Continuer', 'Continue')}</button>
        </div>
      )}

      {step === 'style' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{t('Quel style de musique ?', 'What music style?')}</h2>
          <p className="text-gray-500 mb-6">{t('Choisis l\'ambiance de ta chanson', 'Choose your song\'s vibe')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {styles.map(s => {
              const meta = styleMeta[s] || { emoji: '🎵', gradient: 'from-brand-500 to-pink-500' };
              return (
                <button key={s} onClick={() => setStyle(s)} className={`relative overflow-hidden flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all ${style === s ? 'border-brand-600' : 'border-gray-200 hover:border-brand-200'}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-10`} />
                  <span className="text-3xl relative">{meta.emoji}</span>
                  <span className="text-sm font-medium text-gray-700 relative">{getStyleLabel(s)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={goBack} className="btn-secondary px-4"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={goNext} disabled={!style} className="btn-primary flex-1">{t('Continuer', 'Continue')}</button>
          </div>
        </div>
      )}

      {step === 'voice' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{t('Quel type de voix ?', 'What voice type?')}</h2>
          <p className="text-gray-500 mb-6">{t('Homme, femme ou duo ?', 'Male, female or duet?')}</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { key: 'male' as Gender, emoji: '👨', label: t('Homme', 'Male') },
              { key: 'female' as Gender, emoji: '👩', label: t('Femme', 'Female') },
              { key: 'duet' as Gender, emoji: '👫', label: t('Duo', 'Duet') },
            ].map(g => (
              <button key={g.key} onClick={() => setGender(g.key)} className={`flex flex-col items-center gap-2 py-6 rounded-2xl border-2 transition-all ${gender === g.key ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-200'}`}>
                <span className="text-3xl">{g.emoji}</span>
                <span className="text-sm font-medium text-gray-700">{g.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={goBack} className="btn-secondary px-4"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={goNext} disabled={!gender} className="btn-primary flex-1">{t('Continuer', 'Continue')}</button>
          </div>
        </div>
      )}

      {step === 'message' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{t('Décris ce que tu veux dans ta chanson', 'Describe what you want in your song')}</h2>
          <div className="relative mb-2">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full py-3 px-4 pr-12 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none min-h-[140px]"
              placeholder={t('Ex : Joyeux anniversaire à mon ami Dioula...', 'E.g. Happy birthday to my friend...')}
            />
            <button type="button" onClick={toggleMic} className={`absolute top-3 right-3 p-2 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`} title={t('Dicter au micro', 'Dictate')}>
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <button type="button" onClick={handleGenerateLyrics} disabled={lyricLoading} className="flex items-center gap-2 text-sm text-brand-700 font-medium mb-4 hover:text-brand-800">
            <Wand2 className="w-4 h-4" /> {lyricLoading ? t('Génération...', 'Generating...') : t('Générer des paroles avec l\'IA', 'Generate lyrics with AI')}
          </button>
          <p className="text-xs text-gray-400 mb-6">
            {t('Minimum 10 caractères', 'Minimum 10 characters')} ({message.length}/10) · 💡 {t('Plus tu donnes de détails, plus ta chanson sera personnalisée !', 'The more detail you give, the more personalized your song will be!')}
          </p>
          <div className="flex gap-3">
            <button onClick={goBack} className="btn-secondary px-4"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={goNext} disabled={message.length < 10} className="btn-primary flex-1">{t('Continuer', 'Continue')}</button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{t('Plus qu\'une étape ! 🎉', 'One more step! 🎉')}</h2>
          <p className="text-gray-500 mb-6">
            {balance !== null && balance < 1
              ? t('Tu as besoin de 1 Note pour créer ta chanson', 'You need 1 Note to create your song')
              : t('Prêt à créer ta chanson', 'Ready to create your song')}
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            <div className="p-4 rounded-xl bg-gray-50">
              <p className="text-2xl mb-1">{occasion ? occasionMeta[occasion] : '🎉'}</p>
              <p className="text-xs font-semibold text-gray-700 capitalize">{occasion ? getOccasionLabel(occasion) : ''}</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50">
              <p className="text-2xl mb-1">{style ? styleMeta[style]?.emoji ?? '🎵' : '🎵'}</p>
              <p className="text-xs font-semibold text-gray-700 capitalize">{style ? getStyleLabel(style) : ''}</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50">
              <p className="text-2xl mb-1">{gender ? genderMeta[gender].emoji : '🎤'}</p>
              <p className="text-xs font-semibold text-gray-700">{gender ? t(genderMeta[gender].fr, genderMeta[gender].en) : ''}</p>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {balance !== null && balance < 1 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">{t('Nos offres de Notes', 'Our Notes packs')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {packs.map(pack => (
                  <a key={pack.id} href="/notes" className="rounded-xl border-2 border-gray-200 hover:border-brand-300 p-3 text-center transition-colors">
                    <p className="text-lg font-bold text-brand-600">{pack.credits} {t('Notes', 'Notes')}</p>
                    <p className="text-[11px] text-gray-500 mb-1">{pack.label}</p>
                    <p className="text-sm font-semibold text-gray-800">{pack.price_fcfa.toLocaleString('fr-FR')} FCFA</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={goBack} className="btn-secondary px-4"><ChevronLeft className="w-5 h-5" /></button>
            {balance === null ? (
              <button disabled className="btn-secondary flex-1 opacity-60">{t('Vérification du solde…', 'Checking balance…')}</button>
            ) : balance < 1 ? (
              <a href="/notes" className="btn-primary flex-1 text-center">{t('Acheter des Notes', 'Buy Notes')}</a>
            ) : (
              <button onClick={handleSubmit} disabled={status === 'generating'} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {status === 'generating' ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('Génération...', 'Generating...')}
                  </>
                ) : (
                  <><Sparkles className="w-5 h-5" /> {t('Générer ma chanson', 'Generate my song')}</>
                )}
              </button>
            )}
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">🔒 {t('Paiement sécurisé • Mobile Money & Carte', 'Secure payment • Mobile Money & Card')}</p>
        </div>
      )}
    </div>
  );
}
