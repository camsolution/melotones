
import { supabaseAdmin } from '@/lib/admin';
import { sendEmail } from '@/lib/email';
import { createHumanTask } from '@/lib/humanTasks';
import { getAdminEmail } from '@/lib/cron';

export type ReviewType = 'SONG' | 'PLATFORM';
export type ModerationAction = 'ALLOW' | 'HUMAN_REVIEW' | 'HIDE_AND_ALERT_ADMIN' | 'REJECT';

export type ModerationDecision = {
  action: ModerationAction;
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  categories: string[];
  confidence: number;
  reviewLanguage: string | null;
  languageConfidence: number;
  adminAlertRequired: boolean;
  reason: string | null;
};

// Politique versionnée pour l'audit
const POLICY_VERSION = '1.0.0';

// Règles déterministes simples
const BLOCKED_PATTERNS: { pattern: RegExp; category: string; severity: string }[] = [
  { pattern: /\b(threat|terror|bomb|kill|hurt)\b/i, category: 'VIOLENCE', severity: 'HIGH' },
  { pattern: /\b(hate|nazi|racist|homophob|transphob)\b/i, category: 'HATE_SPEECH', severity: 'HIGH' },
  { pattern: /\b(doxx|personal address|phone number)\b/i, category: 'DOXXING', severity: 'HIGH' },
  { pattern: /\b(child|minor|underage|illegal)\b/i, category: 'CHILD_EXPLOITATION', severity: 'URGENT' },
  { pattern: /\b(spam|scam|phish|crypto|prize|winner)\b/i, category: 'SPAM', severity: 'MEDIUM' },
  { pattern: /\b(url|http|www\.|link)\b/i, category: 'MALICIOUS_LINK', severity: 'MEDIUM' },
];

// Détection PII (email, téléphone)
const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/,
];

// Détection de spam simple (répétitions excessives)
function detectSpam(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const repeated = words.some((w, i) => i > 0 && w === words[i-1] && w.length > 3);
  return repeated || text.length > 500;
}

// Détection de doublons potentiels (à améliorer avec un historique)
async function detectDuplicate(userId: string, text: string, limit = 5): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('testimonials')
    .select('message')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!data) return false;
  return data.some(d => d.message.trim().toLowerCase() === text.trim().toLowerCase());
}

// Classification via Gemini (réutilise une partie de lib/moderation.ts)
async function classifyReviewText(text: string): Promise<{ category: string; reason: string }> {
  // On importe dynamiquement pour éviter les dépendances circulaires
  const { classifyMessage } = await import('./moderation');
  return classifyMessage(text);
}

export async function moderateUserReview(input: {
  reviewType: ReviewType;
  text: string;
  rating: number;
  userId: string;
  songId?: string | null;
}): Promise<ModerationDecision> {
  const { reviewType, text, rating, userId } = input;
  const categories: string[] = [];
  const severityLevels: string[] = [];
  let confidence = 0.9; // confiance par défaut pour règles déterministes
  let adminAlertRequired = false;
  let action: ModerationAction = 'ALLOW';
  let reason: string | null = null;
  let reviewLanguage: string | null = null;
  let languageConfidence = 0;

  // Détection de langue approximative FR/EN
  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) {
    reviewLanguage = 'fr';
    languageConfidence = 0.8;
  } else {
    reviewLanguage = 'en';
    languageConfidence = 0.7;
  }

  // 1. PII
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      categories.push('PERSONAL_DATA');
      severityLevels.push('HIGH');
      action = 'HIDE_AND_ALERT_ADMIN';
      adminAlertRequired = true;
      reason = 'Contient des données personnelles';
      break;
    }
  }

  // 2. Patterns bloqués
  if (action === 'ALLOW') {
    for (const rule of BLOCKED_PATTERNS) {
      if (rule.pattern.test(text)) {
        categories.push(rule.category);
        severityLevels.push(rule.severity);
        if (rule.severity === 'URGENT' || rule.severity === 'HIGH') {
          action = 'HIDE_AND_ALERT_ADMIN';
          adminAlertRequired = true;
          reason = `Violation détectée : ${rule.category}`;
        } else {
          action = 'HUMAN_REVIEW';
          reason = `Règle déclenchée : ${rule.category}`;
        }
        break;
      }
    }
  }

  // 3. Spam
  if (action === 'ALLOW' && detectSpam(text)) {
    categories.push('SPAM');
    severityLevels.push('MEDIUM');
    action = 'HUMAN_REVIEW';
    reason = 'Spam possible';
  }

  // 4. Doublon
  if (action === 'ALLOW' && await detectDuplicate(userId, text)) {
    categories.push('DUPLICATE');
    severityLevels.push('LOW');
    action = 'HUMAN_REVIEW';
    reason = 'Avis dupliqué';
  }

  // 5. Classification IA pour le contenu dangereux/ambigu
  if (action === 'ALLOW') {
    const gemini = await classifyReviewText(text);
    if (gemini.category === 'BLOCK') {
      categories.push('FORBIDDEN_CONTENT');
      severityLevels.push('HIGH');
      action = 'HIDE_AND_ALERT_ADMIN';
      adminAlertRequired = true;
      reason = gemini.reason;
      confidence = 0.95;
    } else if (gemini.category === 'HUMAN_REVIEW') {
      categories.push('AMBIGUOUS');
      severityLevels.push('MEDIUM');
      action = 'HUMAN_REVIEW';
      reason = gemini.reason;
      confidence = 0.75;
    } else if (gemini.category === 'ASK_REWRITE') {
      categories.push('ASK_REWRITE');
      severityLevels.push('LOW');
      action = 'REJECT';
      reason = gemini.reason;
    } else {
      // ALLOW ou ALLOW_WITH_WARNING
      categories.push('ALLOWED');
      severityLevels.push('NONE');
      confidence = 0.98;
    }
  }

  // 6. Alerte admin selon gravité
  if (adminAlertRequired || action === 'HIDE_AND_ALERT_ADMIN') {
    const severity = severityLevels.includes('URGENT') ? 'URGENT' : 'HIGH';
    const adminEmail = await getAdminEmail();
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        `🚨 Alerte modération avis — ${severity}`,
        `<p>Un avis nécessite une modération.</p><p>Type : ${reviewType}</p><p>Catégories : ${categories.join(', ')}</p><p>Message : ${text.slice(0, 200)}</p>`
      );
    }
    await createHumanTask(
      `Modérer un avis ${reviewType}`,
      `Catégories : ${categories.join(', ')}. Voir le dashboard admin.`,
      'review-moderation'
    );
  } else if (action === 'HUMAN_REVIEW') {
    await createHumanTask(
      'Réviser un avis ambigu',
      `Raison : ${reason || 'classification incertaine'}.`,
      'review-moderation'
    );
  }

  // Calculer sévérité finale
  const severityRank: Record<string, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };
  const finalSeverityNum = severityLevels.reduce((max, s) => {
    const rank = severityRank[s] || 0;
    return Math.max(max, rank);
  }, 0);
  const finalSeverity = (Object.keys(severityRank) as (keyof typeof severityRank)[]).find(
    (key) => severityRank[key] === finalSeverityNum
  ) || 'NONE';

  return {
    action,
    severity: finalSeverity as ModerationDecision['severity'],
    categories: Array.from(new Set(categories)),
    confidence,
    reviewLanguage,
    languageConfidence,
    adminAlertRequired,
    reason,
  };
}
