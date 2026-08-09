'use client';
import { useState } from 'react';
import { PACKS } from '@/lib/pricing';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CreditsManager() {
  const { t } = useLanguage();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!selectedPack) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: selectedPack, payment_method: paymentMethod, payment_reference: reference }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Erreur lors de la demande.');
      } else {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="card text-center py-8">
        <p className="text-lg font-semibold text-gray-800 mb-2">{t('Demande envoyée !', 'Request sent!')}</p>
        <p className="text-gray-600">{t('Nous validons votre paiement sous peu et créditons votre compte.', 'We\'ll verify your payment shortly and credit your account.')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {PACKS.map(pack => (
          <button
            key={pack.id}
            onClick={() => setSelectedPack(pack.id)}
            className={`card text-center transition-all ${selectedPack === pack.id ? 'ring-2 ring-brand-600' : ''}`}
          >
            <p className="text-2xl font-bold text-brand-600">{pack.credits}</p>
            <p className="text-sm text-gray-500 mb-2">{t('notes', 'credits')}</p>
            <p className="text-lg font-semibold text-gray-800">{pack.priceFcfa.toLocaleString('fr-FR')} FCFA</p>
          </button>
        ))}
      </div>

      {selectedPack && (
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Méthode de paiement', 'Payment method')}</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="wave">Wave</option>
              <option value="orange_money">Orange Money</option>
            </select>
          </div>
          <p className="text-sm text-gray-500">
            {t('Envoyez le montant via', 'Send the amount via')} {paymentMethod === 'wave' ? 'Wave' : 'Orange Money'} {t('au numéro indiqué, puis collez la référence de transaction ci-dessous.', 'to the number provided, then paste the transaction reference below.')}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Référence de transaction', 'Transaction reference')}</label>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder={t('Ex : TX123456789', 'e.g. TX123456789')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
            {submitting ? t('Envoi…', 'Sending…') : t('Envoyer la demande', 'Send request')}
          </button>
        </div>
      )}
    </div>
  );
}
