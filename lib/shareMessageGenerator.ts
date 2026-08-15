import { GoogleGenerativeAI } from '@google/generative-ai';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';

// Complète le système de templates (SongDetail.tsx) avec une génération IA à
// la demande — jamais automatique, uniquement quand le propriétaire clique
// explicitement sur "Générer un mot", pour garder le coût maîtrisé (voir
// lib/rateLimit.ts pour la protection contre l'abus côté route).
// Fail-open comme lib/captionGenerator.ts : une erreur renvoie null plutôt
// que de bloquer le partage — l'appelant retombe alors sur le template.
export async function generateShareMessage(occasion: string, style: string, lang: 'fr' | 'en'): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const occasionLabel = occasionTranslations[occasion]?.[lang] ?? occasion;
  const styleLabel = styleTranslations[style]?.[lang] ?? style;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Tu aides quelqu'un à écrire un court message personnel pour accompagner le partage d'une chanson qu'il vient de faire composer par intelligence artificielle sur Melotones, à l'intention d'un proche.

Occasion : ${occasionLabel}
Style musical : ${styleLabel}
Langue de réponse : ${lang === 'fr' ? 'français' : 'anglais'}

Écris UNE SEULE phrase courte (moins de 140 caractères), à la première personne, sincère et chaleureuse, qui donne envie d'écouter. Tu peux inclure un ou deux emojis si ça sonne naturel, jamais plus. Jamais de ton publicitaire, jamais de superlatif exagéré ("incroyable", "unique au monde"), jamais le mot "Melotones" dans le message.

Réponds uniquement avec le texte du message — sans guillemets, sans JSON, sans explication.`;

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]);
    const text = result.response.text().trim().replace(/^["']|["']$/g, '');
    if (!text) return null;
    return text.slice(0, 280);
  } catch {
    return null;
  }
}
