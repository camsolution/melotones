'use client';
import { useState } from 'react';
import { Star, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TestimonialPrompt({ generationId }: { generationId: string }) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [consentPublic, setConsentPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (submitted) {
    return (
      <div className="mt-6 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          {t('Merci pour votre avis !', 'Thanks for your feedback!')}
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0 || !message.trim()) return;
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, message: message.trim(), consent_public: consentPublic, generation_id: generationId }),
    });
    setSubmitting(false);
    if (res.ok) setSubmitted(true);
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || t('Erreur, réessayez.', 'Error, please try again.'));
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-100 text-left">
      <p className="text-sm font-medium text-gray-700 mb-2 text-center">{t('Votre avis nous aide beaucoup', 'Your feedback helps a lot')}</p>
      <div className="flex justify-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} étoiles`}
          >
            <Star className={`w-6 h-6 ${(hoverRating || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 600))}
        placeholder={t('Qu\'avez-vous pensé de votre chanson ?', 'What did you think of your song?')}
        className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none"
        rows={3}
      />
      <label className="flex items-start gap-2 mt-2 text-xs text-gray-500">
        <input type="checkbox" checked={consentPublic} onChange={(e) => setConsentPublic(e.target.checked)} className="mt-0.5" />
        {t('J\'accepte que mon avis (note + message, sans autre information) soit affiché publiquement sur melotones.co.', 'I agree that my review (rating + message, no other information) may be displayed publicly on melotones.co.')}
      </label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0 || !message.trim()}
        className="btn-secondary text-sm mt-3 w-full disabled:opacity-50"
      >
        {submitting ? t('Envoi…', 'Sending…') : t('Envoyer mon avis', 'Send my review')}
      </button>
    </div>
  );
}
