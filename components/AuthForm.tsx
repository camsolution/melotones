'use client';
import { useCallback, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Headphones, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Turnstile from '@/components/Turnstile';

const CAPTCHA_ENABLED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function AuthForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (CAPTCHA_ENABLED && !captchaToken) {
      setError(t('Merci de compléter la vérification humaine.', 'Please complete the human verification.'));
      return;
    }
    setLoading(true);
    setError('');
    const options = captchaToken ? { captchaToken } : undefined;
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, ...options } });
      if (error) setError(error.message);
      else { alert(t('Vérifiez votre email pour confirmer votre compte !', 'Check your email to confirm your account!')); router.push('/login'); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password, options });
      if (error) setError(error.message);
      else router.push('/dashboard');
    }
    setCaptchaToken(null);
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[28px] border border-gray-200 bg-white shadow-xl p-8">
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-brand-500 via-magenta-500 to-amber-400">
            <Headphones className="w-7 h-7 text-white" strokeWidth={1.9} />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-gray-800">{isSignUp ? t('Créer un compte', 'Create account') : t('Connexion', 'Login')}</h1>
          <p className="text-gray-500 mt-1">{isSignUp ? t('Rejoignez Melotones gratuitement', 'Join Melotones for free') : t('Heureux de vous revoir', 'Happy to see you again')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && <input type="text" placeholder={t('Nom complet', 'Full name')} value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none" />}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none" />
          <input type="password" placeholder={t('Mot de passe', 'Password')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none" />

          {CAPTCHA_ENABLED && (
            <div className="flex flex-col items-center gap-2">
              <Turnstile onVerify={handleCaptchaVerify} onExpire={handleCaptchaExpire} />
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5" /> {t('Vérification humaine requise', 'Human verification required')}
              </span>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || (CAPTCHA_ENABLED && !captchaToken)}
            className="w-full inline-flex items-center justify-center gap-2 font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 shadow-lg shadow-magenta-200 hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? t('Chargement...', 'Loading...') : isSignUp ? t("S'inscrire", 'Sign up') : t('Se connecter', 'Sign in')}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          {isSignUp ? t('Déjà un compte ?', 'Already have an account?') : t('Pas encore de compte ?', "Don't have an account?")}{' '}
          <button className="text-brand-600 font-semibold hover:underline" onClick={() => { setIsSignUp(!isSignUp); setError(''); setCaptchaToken(null); }}>
            {isSignUp ? t('Se connecter', 'Sign in') : t('Créer un compte', 'Create account')}
          </button>
        </p>
      </div>
    </div>
  );
}
