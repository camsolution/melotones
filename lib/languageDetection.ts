import { GoogleGenerativeAI } from '@google/generative-ai';

export type LanguageDetection = { language: string; label: string; confidence: number } | null;

const LANGUAGE_LABELS: Record<string, string> = { fr: 'Français', en: 'English' };

// MELOTONES_LANGUAGE_DETECTION : simple aide à la saisie, jamais bloquant —
// en cas d'échec/timeout on retourne null et le formulaire retombe sur le
// choix manuel / la langue du compte (voir CreateForm + POST /api/generations).
export async function detectLanguage(text: string): Promise<LanguageDetection> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text || text.trim().length < 8) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `Detect the main language of this text. Reply with ONLY a compact JSON object, no markdown, no code fence: {"language": "<ISO 639-1 code, e.g. fr, en, wo, ar>", "confidence": <0 to 1 number>}.\n\nText: "${text.slice(0, 500)}"`;

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6_000)),
    ]);
    const raw = result.response.text().trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(raw);
    const code = String(parsed.language || '').toLowerCase().slice(0, 2);
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
    if (!code) return null;
    return { language: code, label: LANGUAGE_LABELS[code] || code.toUpperCase(), confidence };
  } catch {
    return null;
  }
}

// La voix chantée ne supporte réellement que fr/en (VOICE_LANGUAGE_NAMES,
// lib/promptBudget.ts) — une langue détectée en dehors de ce périmètre reste
// affichable à titre informatif mais ne doit jamais devenir sélectionnable
// comme langue de génération (section 10 : ne jamais proposer une langue non
// réellement supportée).
export function isSupportedSongLanguage(code: string): code is 'fr' | 'en' {
  return code === 'fr' || code === 'en';
}
