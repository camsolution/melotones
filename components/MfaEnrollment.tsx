'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';

type Factor = { id: string; status: string; factor_type: string };

// Auto-enrôlement TOTP côté client via l'API MFA native de Supabase Auth —
// aucune nouvelle table, aucune route serveur : Supabase gère déjà tout
// l'état (facteurs, niveau d'authentification) dans son propre schéma auth.
export default function MfaEnrollment() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find(f => f.status === 'verified') ?? null;
    setFactor(verified);
    setLoading(false);
  };

  useEffect(() => { loadFactors(); }, []);

  const startEnroll = async () => {
    setError('');
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setPendingFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  };

  const cancelEnroll = async () => {
    if (pendingFactorId) await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode('');
    setError('');
  };

  const confirmEnroll = async () => {
    if (!pendingFactorId || code.trim().length !== 6) return;
    setError('');
    setBusy(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
    if (challengeError || !challenge) {
      setBusy(false);
      setError(challengeError?.message || t('Erreur de vérification.', 'Verification error.'));
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId, challengeId: challenge.id, code: code.trim(),
    });
    setBusy(false);
    if (verifyError) { setError(t('Code invalide, réessaie.', 'Invalid code, try again.')); return; }
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode('');
    await loadFactors();
  };

  const disable = async () => {
    if (!factor) return;
    if (!confirm(t(
      'Désactiver la double authentification sur ce compte ? Ce compte redeviendra protégé par le mot de passe/lien magique seul.',
      'Disable two-factor authentication on this account? It will fall back to password/magic-link only.'
    ))) return;
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    await loadFactors();
  };

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 mb-5">
      <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-3">
        {t('Double authentification', 'Two-factor authentication')}
      </div>

      {factor ? (
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="w-4 h-4" /> {t('Activée', 'Enabled')}
          </span>
          <button disabled={busy} onClick={disable} className="text-xs text-red-500 hover:text-red-600 font-semibold disabled:opacity-50">
            {t('Désactiver', 'Disable')}
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 flex-none mt-0.5" />
            {t('Scanne ce QR code avec Google Authenticator, Authy ou une app équivalente.', 'Scan this QR code with Google Authenticator, Authy, or a similar app.')}
          </p>
          {qrCode && (
            <img src={qrCode} alt="QR code TOTP" className="w-40 h-40 mx-auto border border-gray-100 rounded-lg" />
          )}
          {secret && (
            <p className="text-[11px] text-gray-400 text-center break-all">
              {t('Ou saisis ce code manuellement :', 'Or enter this code manually:')} <span className="font-mono">{secret}</span>
            </p>
          )}
          <input
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000" inputMode="numeric" maxLength={6}
            className="w-full text-center tracking-[0.4em] font-mono text-lg border border-gray-200 rounded-lg px-3 py-2"
          />
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <div className="flex gap-2">
            <button onClick={cancelEnroll} disabled={busy} className="flex-1 text-xs font-semibold text-gray-500 border border-gray-200 rounded-full py-2 disabled:opacity-50">
              {t('Annuler', 'Cancel')}
            </button>
            <button onClick={confirmEnroll} disabled={busy || code.length !== 6} className="flex-1 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-full py-2 disabled:opacity-50">
              {busy ? t('Vérification…', 'Verifying…') : t('Activer', 'Enable')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={startEnroll} disabled={busy} className="w-full text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-full py-2.5 disabled:opacity-50">
          {t('Activer la double authentification', 'Enable two-factor authentication')}
        </button>
      )}
    </div>
  );
}
