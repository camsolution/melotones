'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CreditsManager() {
  const { t } = useLanguage();
  return (
    <div className="text-center text-gray-500 py-4">
      {t(
        'Achat de crédits bientôt disponible.',
        'Credit purchase coming soon.'
      )}
    </div>
  );
}
