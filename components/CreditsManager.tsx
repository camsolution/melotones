'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CreditsManager() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const addCredits = async () => {
    setLoading(true);
    try {
      if (process.env.NEXT_PUBLIC_MOCK_PAYMENTS === 'true') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { alert(t("Connectez-vous d'abord.", 'Please login first.')); setLoading(false); return; }
        const res = await fetch('/api/credits/add-mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 10 }) });
        if (!res.ok) throw new Error(await res.text());
        alert(t('10 crédits ajoutés (mode test) !', '10 credits added (test mode)!'));
        window.location.reload();
      } else {
        const res = await fetch('/api/credits/purchase', { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());
        const { url } = await res.json();
        if (url) window.location.href = url;
        else throw new Error(t('URL de paiement manquante', 'Missing payment URL'));
      }
    } catch (error: any) {
      alert(error.message || t('Erreur lors de la transaction', 'Transaction error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={addCredits} disabled={loading} className="btn-primary w-full mt-2">
      {loading ? t('Patientez...', 'Please wait...') : t('Acheter 10 crédits (test)', 'Buy 10 credits (test)')}
    </button>
  );
}
