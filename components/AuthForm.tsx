'use client';
import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Music } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AuthForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (error) setError(error.message);
      else { alert(t('Vérifiez votre email pour confirmer votre compte !', 'Check your email to confirm your account!')); router.push('/login'); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="card w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-brand-100 p-3 rounded-full mb-4"><Music className="w-8 h-8 text-brand-600" /></div>
          <h1 className="text-2xl font-bold text-gray-800">{isSignUp ? t('Créer un compte', 'Create account') : t('Connexion', 'Login')}</h1>
          <p className="text-gray-500">{isSignUp ? t('Rejoignez Melotones gratuitement', 'Join Melotones for free') : t('Heureux de vous revoir', 'Happy to see you again')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && <input type="text" placeholder={t('Nom complet', 'Full name')} value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none" />}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none" />
          <input type="password" placeholder={t('Mot de passe', 'Password')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? t('Chargement...', 'Loading...') : isSignUp ? t("S'inscrire", 'Sign up') : t('Se connecter', 'Sign in')}</button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          {isSignUp ? t('Déjà un compte ?', 'Already have an account?') : t('Pas encore de compte ?', "Don't have an account?")}{' '}
          <button className="text-brand-600 font-semibold hover:underline" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? t('Se connecter', 'Sign in') : t('Créer un compte', 'Create account')}
          </button>
        </p>
      </div>
    </div>
  );
}
