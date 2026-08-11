'use client';
import { useState, useEffect } from 'react';
import { Pack } from '@/lib/pricing';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, Tag } from 'lucide-react';

const PAYMENT_METHODS = [
  { key: 'wave', label: 'Wave' },
  { key: 'orange_money', label: 'Orange Money' },
  { key: 'card', label: { fr: 'Carte bancaire', en: 'Card' } },
  { key: 'other', label: { fr: 'Autre', en: 'Other' } },
] as const;

export default function CreditsManager() {
  const { t } = useLanguage();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('wave');
  const [paymentReference, setPaymentReference] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<{ credits: number; price_fcfa: number; original_price_fcfa: number; discount_applied: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/pricing').then(res => res.json()).then(setPacks).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!selectedPack) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_id: selectedPack,
          payment_method: paymentMethod,
          payment_reference: paymentReference || undefined,
          coupon_code: couponCode || undefined,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        setErrorMsg(t('Le serveur a renvoyé une réponse inattendue.', 'Server returned an unexpected response.'));
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || t('Erreur lors de la demande.', 'Request error.'));
        setLoading(false);
        return;
      }

      setResult(data);
    } catch (err: any) {
      setErrorMsg(t('Impossible de contacter le serveur, vérifiez votre connexion.', 'Could not reach the server, check your connection.'));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="font-display font-bold text-lg text-gray-800">{t('Demande envoyée !', 'Request sent!')}</h3>
        <p className="text-sm text-gray-600 mt-2">
          {t('Ta demande de', 'Your request for')} <strong>{result.credits} {t('Notes', 'Notes')}</strong> {t('a bien été reçue.', 'has been received.')}
        </p>
        {result.discount_applied && (
          <p className="text-sm text-emerald-700 font-semibold mt-1">
            {t('Code promo appliqué :', 'Promo code applied:')} {result.price_fcfa.toLocaleString('fr-FR')} FCFA
            <span className="line-through text-gray-400 ml-2">{result.original_price_fcfa.toLocaleString('fr-FR')} FCFA</span>
          </p>
        )}
        {!result.discount_applied && (
          <p className="text-sm text-gray-700 font-semibold mt-1">{result.price_fcfa.toLocaleString('fr-FR')} FCFA</p>
        )}
        <p className="text-xs text-gray-500 mt-4">
          {t('Tes Notes seront ajoutées dès validation du paiement, généralement sous peu.', 'Your Notes will be added once payment is confirmed, usually shortly.')}
        </p>
        <button onClick={() => { setResult(null); setSelectedPack(null); setCouponCode(''); setPaymentReference(''); }} className="text-brand-600 font-semibold text-sm hover:underline mt-4">
          {t('Faire une autre demande', 'Make another request')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {packs.map(pack => (
          <button
            key={pack.id}
            onClick={() => setSelectedPack(pack.id)}
            className={`rounded-2xl border-2 p-5 text-center transition-all ${selectedPack === pack.id ? 'border-brand-600 bg-gradient-to-br from-brand-50 to-magenta-50' : 'border-gray-200 hover:border-brand-200'}`}
          >
            <p className="text-2xl font-display font-extrabold text-brand-600">{pack.credits}</p>
            <p className="text-sm text-gray-500 mb-2">{t('notes', 'credits')}</p>
            <p className="text-lg font-semibold text-gray-800">{pack.price_fcfa.toLocaleString('fr-FR')} FCFA</p>
          </button>
        ))}
      </div>

      {selectedPack && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Moyen de paiement', 'Payment method')}</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold border-2 transition-colors ${paymentMethod === m.key ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-gray-200 text-gray-600'}`}
                >
                  {typeof m.label === 'string' ? m.label : t(m.label.fr, m.label.en)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Référence de paiement (optionnel)', 'Payment reference (optional)')}</p>
            <input
              type="text"
              value={paymentReference}
              onChange={e => setPaymentReference(e.target.value)}
              maxLength={100}
              placeholder={t('Ex : ID de transaction Wave', 'E.g. Wave transaction ID')}
              className="w-full py-2.5 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none text-[13.5px]"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> {t('Code promo (optionnel)', 'Promo code (optional)')}
            </p>
            <input
              type="text"
              value={couponCode}
              onChange={e => setCouponCode(e.target.value.toUpperCase())}
              maxLength={40}
              placeholder={t('Ex : PARTENAIRE10', 'E.g. PARTNER10')}
              className="w-full py-2.5 px-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-300 outline-none text-[13.5px] uppercase"
            />
          </div>

          <p className="text-xs text-gray-500">
            {t('Paiement manuel via Wave, Orange Money ou carte — ta demande est validée par notre équipe.', 'Manual payment via Wave, Orange Money or card — your request is reviewed by our team.')}
          </p>
          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
          <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full">
            {loading ? t('Envoi…', 'Sending…') : t('Envoyer ma demande', 'Send my request')}
          </button>
        </div>
      )}
    </div>
  );
}
