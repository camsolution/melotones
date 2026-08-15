'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Affiché par app/admin/page.tsx quand la session est au niveau aal1 alors
// qu'un facteur TOTP vérifié existe (nextLevel === 'aal2') — bloque l'accès
// au dashboard tant que le code n'est pas confirmé. Scope volontairement
// limité à /admin : ne touche ni le middleware global ni /auth/callback,
// pour ne pas risquer de casser la connexion des utilisateurs normaux.
export default function AdminMfaChallenge() {
  const router = useRouter();
  const supabase = createClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find(f => f.status === 'verified');
      if (!verified) return;
      setFactorId(verified.id);
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: verified.id });
      if (challenge) setChallengeId(challenge.id);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId || code.trim().length !== 6) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() });
    setBusy(false);
    if (error) { setError('Code invalide, réessaie.'); setCode(''); return; }
    router.refresh();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] border border-gray-200 bg-white shadow-xl p-8 text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-brand-50">
          <ShieldCheck className="w-6 h-6 text-brand-600" strokeWidth={1.9} />
        </div>
        <h1 className="font-display font-extrabold text-xl text-gray-800 mb-1">Vérification en deux étapes</h1>
        <p className="text-sm text-gray-500 mb-6">Saisis le code à 6 chiffres de ton application d'authentification.</p>
        <input
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000" inputMode="numeric" maxLength={6} autoFocus
          className="w-full text-center tracking-[0.4em] font-mono text-lg border border-gray-200 rounded-lg px-3 py-3 mb-3"
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button
          type="submit" disabled={busy || code.length !== 6 || !challengeId}
          className="w-full font-bold text-[14.5px] py-3.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500 disabled:opacity-50"
        >
          {busy ? 'Vérification…' : 'Vérifier'}
        </button>
      </form>
    </div>
  );
}
