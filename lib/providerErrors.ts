import { supabaseAdmin } from '@/lib/admin';

type Lang = 'fr' | 'en';

// Correspondances par motif — les messages bruts de MusicGPT sont en anglais et
// varient dans leur formulation exacte, donc on matche par mot-clé plutôt que
// par égalité stricte.
const ERROR_PATTERNS: { match: RegExp; fr: string; en: string }[] = [
  {
    match: /more than 300 characters|cannot be more than|too long/i,
    fr: "Votre message est trop long pour ce style musical — réduisez-le et réessayez.",
    en: 'Your message is too long for this music style — shorten it and try again.',
  },
  {
    match: /unauthorized|invalid.*api.?key|forbidden/i,
    fr: 'Notre service de génération musicale est temporairement indisponible.',
    en: 'Our music generation service is temporarily unavailable.',
  },
  {
    match: /quota|rate limit|too many|slow down/i,
    fr: 'Notre fournisseur est momentanément surchargé — merci de réessayer dans quelques minutes.',
    en: 'Our provider is temporarily overloaded — please try again in a few minutes.',
  },
  {
    match: /timeout|timed out|network/i,
    fr: 'Le fournisseur a mis trop de temps à répondre — merci de réessayer.',
    en: 'The provider took too long to respond — please try again.',
  },
];

const GENERIC: Record<Lang, string> = {
  fr: "Une erreur technique est survenue chez notre fournisseur de génération musicale. Notre équipe a été automatiquement prévenue — merci de réessayer dans quelques instants.",
  en: 'A technical error occurred with our music generation provider. Our team has been automatically notified — please try again shortly.',
};

export function localizeProviderError(rawMessage: string, lang: string): string {
  const l: Lang = lang === 'en' ? 'en' : 'fr';
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.match.test(rawMessage)) return pattern[l];
  }
  return GENERIC[l];
}

// Toujours appelé, y compris pour les comptes admin (qui ne passent pas par
// autoRefund) — c'est ce log qui alimente l'onglet Alertes du dashboard admin,
// donc aucune panne fournisseur ne doit rester invisible.
export async function logProviderError(generationId: string | null, userId: string, message: string, provider = 'musicgpt') {
  await supabaseAdmin.from('provider_errors').insert({ generation_id: generationId, user_id: userId, provider, message });
}
