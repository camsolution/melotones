import { styleDescriptors } from './styleDescriptors';

// Limite dure de l'API MusicGPT sur le champ music_style (confirmé empiriquement :
// "Music Style cannot be more than 300 characters"). Marge de sécurité incluse.
export const PROMPT_MAX_LENGTH = 295;
export const MIN_MESSAGE_LENGTH = 10;

export const VOICE_LANGUAGE_NAMES: Record<string, string> = { fr: 'French', en: 'English' };

export function enrichStyle(style: string): string {
  const styleKey = style.toLowerCase().replace(/[^a-z]/g, '');
  return styleDescriptors[styleKey] || style;
}

function scaffold(enrichedStyle: string, occasion: string, voiceLanguage: string, message: string, nameDirective: string = ''): string {
  return `A ${enrichedStyle} song for ${occasion}, sung entirely in ${voiceLanguage}.${message ? ` About: ${message}` : ''}${nameDirective ? ` ${nameDirective}` : ''}`;
}

// Longueur maximale que le message libre peut occuper pour ce style/occasion/langue
// sans dépasser la limite de MusicGPT — c'est ce budget qui pilote la jauge du
// formulaire ET la validation serveur, pour qu'ils restent toujours cohérents.
export function computeMessageBudget(style: string, occasion: string, voiceLanguage: string): { min: number; max: number } {
  const enrichedStyle = enrichStyle(style);
  const overhead = scaffold(enrichedStyle, occasion, voiceLanguage, '').length;
  const max = Math.max(MIN_MESSAGE_LENGTH, PROMPT_MAX_LENGTH - overhead);
  return { min: MIN_MESSAGE_LENGTH, max };
}

function truncateToWordBoundary(text: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
}

// Filet de sécurité : avec la validation min/max en amont, ce cas ne devrait
// quasiment plus se produire, mais on garde la troncature pour ne jamais envoyer
// à MusicGPT un prompt qui dépasserait sa limite.
export function buildPrompt(style: string, occasion: string, voiceLanguage: string, message: string, nameDirective: string = ''): string {
  let styleText = enrichStyle(style);
  let messageText = message;
  let prompt = scaffold(styleText, occasion, voiceLanguage, messageText, nameDirective);

  if (prompt.length > PROMPT_MAX_LENGTH) {
    const overBy = prompt.length - PROMPT_MAX_LENGTH;
    messageText = truncateToWordBoundary(messageText, messageText.length - overBy);
    prompt = scaffold(styleText, occasion, voiceLanguage, messageText, nameDirective);
  }
  if (prompt.length > PROMPT_MAX_LENGTH) {
    const overBy = prompt.length - PROMPT_MAX_LENGTH;
    styleText = truncateToWordBoundary(styleText, styleText.length - overBy);
    prompt = scaffold(styleText, occasion, voiceLanguage, messageText, nameDirective);
  }
  // Filet ultime : si même après troncature du style le prompt dépasse encore
  // la limite, on abandonne le nameDirective plutôt que de risquer un envoi
  // rejeté par MusicGPT — le prénom est de toute façon déjà probablement
  // présent dans le message utilisateur lui-même.
  if (prompt.length > PROMPT_MAX_LENGTH && nameDirective) {
    prompt = scaffold(styleText, occasion, voiceLanguage, messageText, '');
  }
  return prompt;
}
