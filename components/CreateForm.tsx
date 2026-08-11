'use client';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, AlertTriangle, Mic, MicOff, Wand2, ChevronLeft, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';
import { styleMeta } from '@/lib/styleMeta';
import { occasionMeta } from '@/lib/occasionMeta';
import { Pack } from '@/lib/pricing';
import { VOICE_LANGUAGE_NAMES, computeMessageBudget, MIN_MESSAGE_LENGTH } from '@/lib/promptBudget';

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
const STEP_LABELS: Record<Step, { fr: string; en: string }> = {
  occasion: { fr: 'Occasion', en: 'Occasion' },
  style: { fr: 'Style', en: 'Style' },
  voice: { fr: 'Voix', en: 'Voice' },
  message: { fr: 'Message', en: 'Message' },
  review: { fr: 'Récap', en: 'Review' },
};

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lyricLoading, setLyricLoading] = useState(false);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [showCustomStyle, setShowCustomStyle] = useState(false);
  const recognitionRef = useRef<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const step = STEPS[stepIndex];

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => { setBalance(d.balance ?? null); setIsAdmin(d.is_admin === true); }).catch(() => {});
  }, []);

  useEffect(() => {
    const preselected = searchParams.get('style');
    if (preselected && styles.includes(preselected)) setStyle(preselected);
  }, []);

  useEffect(() => {
    if (!isAdmin && balance !== null && balance < 1 && packs.length === 0) {
      fetch('/api/pricing').then(r => r.json()).then(setPacks).catch(() => {});
    }
  }, [balance, isAdmin]);

  const getOccasionLabel = (key: string) => occasionTranslations[key]?.[lang] ?? key;
  const getStyleLabel = (key: string) => styleTranslations[key]?.[lang] ?? key;

  // Le style choisi détermine la place restante pour le message libre avant la
  // limite de MusicGPT — les styles les plus décrits (Arabic, Cabo Love...)
  // laissent moins de marge que les styles plus courts.
  const voiceLanguage = VOICE_LANGUAGE_NAMES[lang] || 'French';
  const messageBudget = style ? computeMessageBudget(style, occasion || '', voiceLanguage) : { min: MIN_MESSAGE_LENGTH, max: 400 };
  const messageLen = message.length;
  const messageZone: 'short' | 'good' | 'warn' | 'over' =
    messageLen < messageBudget.min ? 'short' :
    messageLen > messageBudget.max ? 'over' :
    messageLen > messageBudget.max * 0.8 ? 'warn' : 'good';
  const messageZoneMeta = {
    short: { color: '#EF4444', bg: 'bg-red-50', label: t('Trop court', 'Too short'), icon: '❌' },
    good: { color: '#22C55E', bg: 'bg-emerald-50', label: t('Bon', 'Good'), icon: '✅' },
    warn: { color: '#F59E0B', bg: 'bg-amber-50', label: t('Presque plein', 'Almost full'), icon: '⚠️' },
    over: { color: '#EF4444', bg: 'bg-red-50', label: t('Trop long', 'Too long'), icon: '❌' },
  }[messageZone];
  const messageValid = messageLen >= messageBudget.min && messageLen <= messageBudget.max;

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
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-8 md:py-10">
      <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-7 md:p-9">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wide">
            {t('Étape', 'Step')} {stepIndex + 1}/{STEPS.length} · {t(STEP_LABELS[step].fr, STEP_LABELS[step].en)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-7">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-gradient-to-r from-brand-600 to-magenta-500' : 'bg-gray-100'
              }`}
            />
          ))}
        </div>

        {process.env.NEXT_PUBLIC_MOCK_AI === 'true' && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl mb-6 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span><strong>{t('Mode démo :', 'Demo mode:')}</strong> {t('génération simulée.', 'simulated generation.')}</span>
          </div>
        )}

        {step === 'occasion' && (
          <div>
            <h2 className="font-display font-extrabold text-2xl text-gray-800 mb-1">{t('Pour quelle occasion ?', 'For what occasion?')}</h2>
            <p className="text-gray-500 text-[15px] mb-6">{t('Choisis le moment que tu veux célébrer', 'Choose the moment you want to celebrate')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {occasions.map(o => (
                <button key={o} onClick={() => setOccasion(o)} className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all ${occasion === o ? 'border-brand-600 bg-gradient-to-br from-brand-50 to-magenta-50' : 'border-gray-200 hover:border-brand-200'}`}>
                  <span className="text-3xl">{occasionMeta[o]}</span>
                  <span className="text-sm font-semibold text-gray-700">{getOccasionLabel(o)}</span>
                </button>
              ))}
            </div>
            <button onClick={goNext} disabled={!occasion} className="w-full font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 shadow-lg shadow-magenta-200 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0">
              {t('Continuer', 'Continue')}
            </button>
          </div>
        )}

        {step === 'style' && (
          <div>
            <h2 className="font-display font-extrabold text-2xl text-gray-800 mb-1">{t('Quel style de musique ?', 'What music style?')}</h2>
            <p className="text-gray-500 text-[15px] mb-6">{t('Choisis l\'ambiance de ta chanson', 'Choose your song\'s vibe')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {styles.map(s => {
                const meta = styleMeta[s] || { emoji: '🎵', gradient: 'from-brand-500 to-magenta-500' };
                return (
                  <button key={s} onClick={() => { setStyle(s); setShowCustomStyle(false); }} className={`relative overflow-hidden flex flex-col items-center gap-2 py-5 rounded-2xl border-2 transition-all ${style === s && !showCustomStyle ? 'border-brand-600' : 'border-gray-200 hover:border-brand-200'}`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-10`} />
                    <span className="text-3xl relative">{meta.emoji}</span>
                    <span className="text-sm font-semibold text-gray-700 relative">{getStyleLabel(s)}</span>
                  </button>
                );
              })}
              <button
                onClick={() => { setShowCustomStyle(true); setStyle(prev => (styles.includes(prev || '') ? '' : prev)); }}
                className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-dashed transition-all ${showCustomStyle ? 'border-brand-600 bg-gradient-to-br from-brand-50 to-magenta-50' : 'border-gray-300 hover:border-brand-200'}`}
              >
                <span className="text-3xl">✏️</span>
                <span className="text-sm font-semibold text-gray-700">{t('Autre style', 'Other style')}</span>
              </button>
            </div>

            {showCustomStyle && (
              <div className="mb-6">
                <input
                  type="text"
                  value={style ?? ''}
                  onChange={e => setStyle(e.target.value)}
                  maxLength={60}
                  autoFocus
                  placeholder={t('Décris ton style (ex : Jazz manouche, Reggaeton lent...)', 'Describe your style (e.g. Slow reggaeton, Gypsy jazz...)')}
                  className="w-full py-3 px-4 bg-white border-2 border-brand-300 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={goBack} className="w-12 h-12 flex-none flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={!style} className="flex-1 font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 shadow-lg shadow-magenta-200 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0">
                {t('Continuer', 'Continue')}
              </button>
            </div>
          </div>
        )}

        {step === 'voice' && (
          <div>
            <h2 className="font-display font-extrabold text-2xl text-gray-800 mb-1">{t('Quel type de voix ?', 'What voice type?')}</h2>
            <p className="text-gray-500 text-[15px] mb-6">{t('Homme, femme ou duo ?', 'Male, female or duet?')}</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { key: 'male' as Gender, emoji: '👨', label: t('Homme', 'Male') },
                { key: 'female' as Gender, emoji: '👩', label: t('Femme', 'Female') },
                { key: 'duet' as Gender, emoji: '👫', label: t('Duo', 'Duet') },
              ].map(g => (
                <button key={g.key} onClick={() => setGender(g.key)} className={`flex flex-col items-center gap-2 py-6 rounded-2xl border-2 transition-all ${gender === g.key ? 'border-brand-600 bg-gradient-to-br from-brand-50 to-magenta-50' : 'border-gray-200 hover:border-brand-200'}`}>
                  <span className="text-3xl">{g.emoji}</span>
                  <span className="text-sm font-semibold text-gray-700">{g.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={goBack} className="w-12 h-12 flex-none flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={!gender} className="flex-1 font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 shadow-lg shadow-magenta-200 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0">
                {t('Continuer', 'Continue')}
              </button>
            </div>
          </div>
        )}

        {step === 'message' && (
          <div>
            <h2 className="font-display font-extrabold text-2xl text-gray-800 mb-1">{t('Décris ce que tu veux dans ta chanson', 'Describe what you want in your song')}</h2>
            <div className="relative mb-3 mt-6">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full py-3.5 px-4 pr-12 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-brand-300 outline-none min-h-[140px] text-[14.5px]"
                placeholder={t('Ex : Joyeux anniversaire à mon ami Dioula...', 'E.g. Happy birthday to my friend...')}
              />
              <button type="button" onClick={toggleMic} className={`absolute top-3 right-3 p-2 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`} title={t('Dicter au micro', 'Dictate')}>
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {/* Débitmètre vert/jaune/rouge : la marge disponible dépend du style choisi */}
            <div className="mb-2">
              <div className="relative h-2.5 rounded-full overflow-hidden bg-gray-100">
                <div className="absolute inset-y-0 left-0 bg-red-100" style={{ width: `${(messageBudget.min / messageBudget.max) * 100}%` }} />
                <div className="absolute inset-y-0 bg-emerald-100" style={{ left: `${(messageBudget.min / messageBudget.max) * 100}%`, width: `${Math.max(0, 80 - (messageBudget.min / messageBudget.max) * 100)}%` }} />
                <div className="absolute inset-y-0 bg-amber-100" style={{ left: '80%', width: '20%' }} />
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-200" style={{ width: `${Math.min(100, (messageLen / messageBudget.max) * 100)}%`, background: messageZoneMeta.color }} />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span className="text-gray-400">{t('Min', 'Min')} {messageBudget.min}</span>
                <span className="font-bold flex items-center gap-1" style={{ color: messageZoneMeta.color }}>
                  {messageZoneMeta.icon} {messageZoneMeta.label} · {messageLen}/{messageBudget.max}
                </span>
                <span className="text-gray-400">{t('Max', 'Max')} {messageBudget.max}</span>
              </div>
            </div>

            <button type="button" onClick={handleGenerateLyrics} disabled={lyricLoading} className="flex items-center gap-2 text-sm text-brand-600 font-bold mb-4 hover:text-brand-700">
              <Wand2 className="w-4 h-4" /> {lyricLoading ? t('Génération...', 'Generating...') : t('Générer des paroles avec l\'IA', 'Generate lyrics with AI')}
            </button>
            <p className="text-xs text-gray-400 mb-6">
              💡 {t('Plus tu donnes de détails (dans la zone verte), plus ta chanson sera personnalisée !', 'The more detail you give (in the green zone), the more personalized your song will be!')}
            </p>
            <div className="flex gap-3">
              <button onClick={goBack} className="w-12 h-12 flex-none flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={goNext} disabled={!messageValid} className="flex-1 font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 shadow-lg shadow-magenta-200 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0">
                {t('Continuer', 'Continue')}
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div>
            <h2 className="font-display font-extrabold text-2xl text-gray-800 mb-1">{t('Plus qu\'une étape ! 🎉', 'One more step! 🎉')}</h2>
            <p className="text-gray-500 text-[15px] mb-6">
              {!isAdmin && balance !== null && balance < 1
                ? t('Tu as besoin de 1 Note pour créer ta chanson', 'You need 1 Note to create your song')
                : t('Prêt à créer ta chanson', 'Ready to create your song')}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6 text-center">
              <div className="p-4 rounded-2xl bg-gray-50">
                <p className="text-2xl mb-1">{occasion ? occasionMeta[occasion] : '🎉'}</p>
                <p className="text-xs font-semibold text-gray-700 capitalize">{occasion ? getOccasionLabel(occasion) : ''}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50">
                <p className="text-2xl mb-1">{style ? styleMeta[style]?.emoji ?? '🎵' : '🎵'}</p>
                <p className="text-xs font-semibold text-gray-700 capitalize">{style ? getStyleLabel(style) : ''}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50">
                <p className="text-2xl mb-1">{gender ? genderMeta[gender].emoji : '🎤'}</p>
                <p className="text-xs font-semibold text-gray-700">{gender ? t(genderMeta[gender].fr, genderMeta[gender].en) : ''}</p>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            {!isAdmin && balance !== null && balance < 1 && (
              <div className="mb-5">
                <p className="text-sm font-bold text-gray-700 mb-2">{t('Nos offres de Notes', 'Our Notes packs')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {packs.map(pack => (
                    <a key={pack.id} href="/notes" className="rounded-2xl border-2 border-gray-200 hover:border-brand-300 p-3 text-center transition-colors">
                      <p className="text-lg font-display font-extrabold text-brand-600">{pack.credits} {t('Notes', 'Notes')}</p>
                      <p className="text-[11px] text-gray-500 mb-1">{pack.label}</p>
                      <p className="text-sm font-semibold text-gray-800">{pack.price_fcfa.toLocaleString('fr-FR')} FCFA</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={goBack} className="w-12 h-12 flex-none flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"><ChevronLeft className="w-5 h-5" /></button>
              {balance === null && !isAdmin ? (
                <button disabled className="flex-1 font-bold text-[14.5px] py-3.5 rounded-full bg-gray-100 text-gray-400">{t('Vérification du solde…', 'Checking balance…')}</button>
              ) : !isAdmin && balance !== null && balance < 1 ? (
                <a href="/notes" className="flex-1 text-center font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 shadow-lg shadow-magenta-200">{t('Acheter des Notes', 'Buy Notes')}</a>
              ) : (
                <button onClick={handleSubmit} disabled={status === 'generating'} className="flex-1 font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 shadow-lg shadow-magenta-200 flex items-center justify-center gap-2 disabled:opacity-70">
                  {status === 'generating' ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> {t('Génération...', 'Generating...')}</>
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
    </div>
  );
}
