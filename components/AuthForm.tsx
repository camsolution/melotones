'use client';
import { useCallback, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Headphones, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Turnstile from '@/components/Turnstile';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const CAPTCHA_ENABLED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v2.98h3.87c2.27-2.09 3.58-5.17 3.58-8.8z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-2.98c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.07A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.31A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.58.38-2.31V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.07C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

export default function AuthForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle');
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const handleCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

  const handleGoogle = async () => {
    if (!consent) {
      setError(t('Merci d’accepter les CGU et la Politique de confidentialité avant de continuer.', 'Please accept the Terms and Privacy Policy before continuing.'));
      return;
    }
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) setError(error.message);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError(t('Merci d’accepter les CGU et la Politique de confidentialité avant de continuer.', 'Please accept the Terms and Privacy Policy before continuing.'));
      return;
    }
    if (CAPTCHA_ENABLED && !captchaToken) {
      setError(t('Merci de compléter la vérification humaine.', 'Please complete the human verification.'));
      return;
    }
    setStatus('loading');
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, ...(captchaToken ? { captchaToken } : {}) },
    });
    setCaptchaToken(null);
    if (error) { setError(error.message); setStatus('idle'); }
    else setStatus('sent');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10 relative">
      <LanguageSwitcher className="absolute top-5 right-5" />
      <div className="w-full max-w-sm">
        <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-8 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-brand-500 via-magenta-500 to-amber-400">
              <Headphones className="w-7 h-7 text-white" strokeWidth={1.9} />
            </div>
            <span className="font-display font-extrabold text-lg tracking-tight text-gray-800">Melotones</span>
          </div>

          {status === 'sent' ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={1.6} />
              <h1 className="font-display font-extrabold text-xl text-gray-800">{t('Vérifiez votre boîte mail', 'Check your inbox')}</h1>
              <p className="text-sm text-gray-500 max-w-xs">
                {t('On a envoyé un lien de connexion à', 'We sent a sign-in link to')} <strong className="text-gray-700">{email}</strong>.
              </p>
              <button onClick={() => setStatus('idle')} className="text-brand-600 font-semibold text-sm hover:underline mt-2">
                {t('Utiliser une autre adresse', 'Use a different address')}
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display font-extrabold text-2xl text-gray-800 text-balance">{t('Bienvenue sur Melotones', 'Welcome to Melotones')}</h1>
              <p className="text-gray-400 text-sm mt-2 mb-7">{t('Connectez-vous pour créer vos chansons', 'Sign in to create your songs')}</p>

              <label className="relative flex items-start gap-2.5 text-left mb-5 cursor-pointer select-none">
                {!consent && (
                  <span className="absolute -left-6 top-0 text-lg animate-nudge-point" aria-hidden="true">👉</span>
                )}
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => { setConsent(e.target.checked); setError(''); }}
                  className={`mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-300 flex-shrink-0 ${!consent ? 'animate-consent-ring' : ''}`}
                />
                <span className="text-xs text-gray-500 leading-snug">
                  {t('J’accepte les ', 'I accept the ')}
                  <a href="/terms" target="_blank" className="text-brand-600 hover:underline">{t('Conditions d’utilisation', 'Terms of Service')}</a>
                  {t(' et la ', ' and the ')}
                  <a href="/privacy" target="_blank" className="text-brand-600 hover:underline">{t('Politique de confidentialité', 'Privacy Policy')}</a>
                  {t(', et le traitement de mes données personnelles décrit dans cette dernière.', ', and the processing of my personal data as described therein.')}
                </span>
              </label>

              <button
                onClick={handleGoogle}
                disabled={!consent}
                className="w-full flex items-center justify-center gap-3 font-semibold text-[14.5px] py-3.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors mb-5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <GoogleIcon /> {t('Continuer avec Google', 'Continue with Google')}
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs font-semibold text-gray-400 uppercase">{t('ou', 'or')}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4 text-left">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full py-3.5 pl-11 pr-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none text-[14.5px]"
                  />
                </div>

                {CAPTCHA_ENABLED && (
                  <div className="flex flex-col items-center gap-1.5">
                    <Turnstile onVerify={handleCaptchaVerify} onExpire={handleCaptchaExpire} />
                    <span className="flex items-center gap-1 text-[10.5px] text-gray-400">
                      <ShieldCheck className="w-3 h-3" /> {t('Vérification humaine', 'Human verification')}
                    </span>
                  </div>
                )}

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={!consent || status === 'loading' || (CAPTCHA_ENABLED && !captchaToken)}
                  className="w-full font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 shadow-lg shadow-magenta-200 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {status === 'loading' ? t('Envoi...', 'Sending...') : t('Connexion par email', 'Sign in by email')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
