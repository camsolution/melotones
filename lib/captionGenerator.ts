import { GoogleGenerativeAI } from '@google/generative-ai';

export type CaptionSuggestion = {
  captionFr: string;
  captionEn: string;
  hashtags: string;
};

// Toujours une SUGGESTION éditable par un humain avant tout usage — jamais
// publiée telle quelle. Fail-open : en cas d'erreur, retourne null plutôt que
// de bloquer le reste du flux (même principe que lib/moderation.ts).
export async function generateCaptionSuggestion(input: {
  title: string;
  platform: string | null;
  folderName: string | null;
}): Promise<CaptionSuggestion | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  // TikTok et Instagram ne rendent pas les URL de légende cliquables (le lien
  // n'est actif que dans la bio du profil) — écrire "melotones.co" en toutes
  // lettres dans ces légendes donne un CTA que personne ne peut cliquer,
  // constaté en réel : des vues/likes sans clic vers le site. Sur ces deux
  // plateformes, l'appel à l'action doit pointer vers la bio, pas répéter
  // l'URL. Facebook/YouTube affichent le lien cliquable dans le post/la
  // description, donc l'URL directe y reste pertinente.
  const platform = (input.platform || '').toLowerCase();
  const linkNotClickable = platform.includes('tiktok') || platform.includes('instagram');
  const ctaInstruction = linkNotClickable
    ? `Le lien melotones.co N'EST PAS cliquable dans une légende ${platform.includes('tiktok') ? 'TikTok' : 'Instagram'} — ne l'écris jamais dans le texte. L'appel à l'action doit explicitement dire de cliquer le lien dans la bio (ex: "🔗 Lien dans la bio" ou "Lien en bio pour personnaliser ta chanson 👆").`
    : `Un appel à l'action clair avec l'URL melotones.co, cliquable sur cette plateforme.`;

  const prompt = `Tu es un expert en marketing des réseaux sociaux pour Melotones, une plateforme qui compose des chansons personnalisées par IA pour la diaspora africaine (anniversaires, mariages, hommages...).

Rédige une suggestion de légende pour ce visuel marketing, à publier sur "${input.platform || 'réseaux sociaux'}" :
- Titre du visuel : "${input.title}"
- Catégorie : "${input.folderName || 'contenu général'}"

Consignes :
- Ton chaleureux, direct, jamais de fausse promesse ni de statistique inventée
- Pas de symbole ™/® non vérifié
- ${ctaInstruction}
- Reste factuel sur ce que fait réellement Melotones (composer une chanson personnalisée par IA)

Réponds en JSON strict, sans markdown, sans commentaire :
{"caption_fr": "...", "caption_en": "...", "hashtags": "#Melotones #... (5 à 8 hashtags pertinents, séparés par des espaces)"}`;

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]);
    const raw = result.response.text().trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(raw);
    if (!parsed.caption_fr || !parsed.caption_en) return null;
    return {
      captionFr: String(parsed.caption_fr).slice(0, 500),
      captionEn: String(parsed.caption_en).slice(0, 500),
      hashtags: String(parsed.hashtags || '').slice(0, 300),
    };
  } catch {
    return null;
  }
}
