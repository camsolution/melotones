'use client';
import { useState, useEffect } from 'react';
import { Pack } from '@/lib/pricing';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CreditsManager() {
  const { t } = useLanguage();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/pricing').then(res => res.json()).then(setPacks).catch(() => {});
  }, []);

  const handlePay = async () => {
    if (!selectedPack) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: selectedPack }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || t('Erreur lors du paiement.', 'Payment error.'));
        setLoading(false);
        return;
      }
      window.location.href = data.payment_url;
    } catch (err) {
      setErrorMsg(t('Erreur réseau, réessayez.', 'Network error, please retry.'));
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {packs.map(pack => (
          <button
            key={pack.id}
            onClick={() => setSelectedPack(pack.id)}
            className={`card text-center transition-all ${selectedPack === pack.id ? 'ring-2 ring-brand-600' : ''}`}
          >
            <p className="text-2xl font-bold text-brand-600">{pack.credits}</p>
            <p className="text-sm text-gray-500 mb-2">{t('notes', 'credits')}</p>
            <p className="text-lg font-semibold text-gray-800">{pack.price_fcfa.toLocaleString('fr-FR')} FCFA</p>
          </button>
        ))}
      </div>

      {selectedPack && (
        <div className="card space-y-4">
          <p className="text-sm text-gray-500">
            {t('Paiement sécurisé via Wave, Orange Money ou carte bancaire.', 'Secure payment via Wave, Orange Money or card.')}
          </p>
          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
          <button onClick={handlePay} disabled={loading} className="btn-primary w-full">
            {loading ? t('Redirection…', 'Redirecting…') : t('Payer maintenant', 'Pay now')}
          </button>
        </div>
      )}
    </div>
  );
}
