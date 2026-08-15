import { GoogleGenerativeAI } from '@google/generative-ai';

export type CanvaPromptInput = {
  angle: string; // ex: "anniversaire", "diaspora", ou un thème libre
  occasion?: string | null;
  style?: string | null;
};

export type CanvaPromptResult = {
  prompt: string;
  headline: string;
  subtitle: string;
};

// Charte fixe (couleurs/typo/structure), établie manuellement avec l'admin et
// vérifiée contre l'éditeur Canva réel — seule la partie créative (accroche,
// sous-titre, description du visuel) est déléguée à Gemini, pour ne jamais
// perdre la cohérence de marque d'une génération à l'autre.
function buildCanvaAIPrompt(headline: string, subtitle: string, imageDescription: string): string {
  return `Crée un post Instagram carré (1080x1080 px) pour Melotones, une plateforme
qui compose des chansons personnalisées par intelligence artificielle pour
la diaspora africaine (anniversaires, mariages, hommages, félicitations...),
dans des styles comme Afrobeat, Coupé-Décalé, Gospel, Zouk, Rap, Salsa.

Palette de marque à respecter strictement :
- Violet principal #7C3AED
- Magenta accent #F23D82
- Ambre/or accent #FFB23E
- Fond sombre profond #150E29
- Texte clair #F4EEFF
Utilise un dégradé violet vers magenta comme élément graphique fort
(bandeau, forme, ou fond), sur une base sombre. Style moderne, chaleureux,
premium — pas de clichés génériques d'IA (pas de dégradé lilas générique
sur fond blanc, pas d'icônes stock).

Typographie : un titre en police display bold géométrique arrondie
(type Unbounded ou équivalent le plus proche disponible), un texte
secondaire en sans-serif clean et lisible (type Manrope ou équivalent).

Structure en 3 zones bien distinctes et séparées (pas de texte fusionné
dans une image) :
1. Zone de texte titre/accroche : "${headline}"
2. Zone de texte secondaire : "${subtitle}"
3. Zone image/photo dédiée : ${imageDescription}

Ajoute en petit, fixe, dans un coin : le mot "Melotones" comme signature
de marque (pas besoin de logo, juste le nom en typographie).

Ne mets aucune fausse mention (pas de ™/®, pas de chiffre ou statistique
inventé, pas de témoignage fabriqué).`;
}

// Suggestion éditable par un humain avant tout usage — jamais collée
// automatiquement dans Canva. Fail-open : erreur -> null plutôt que de
// bloquer le reste du flux (même principe que lib/moderation.ts).
export async function generateCanvaDesignPrompt(input: CanvaPromptInput): Promise<CanvaPromptResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const context = [
    `Angle marketing : "${input.angle}"`,
    input.occasion ? `Occasion mise en avant : "${input.occasion}"` : null,
    input.style ? `Style musical mis en avant : "${input.style}"` : null,
  ].filter(Boolean).join('\n');

  const prompt = `Tu écris le contenu créatif d'un visuel marketing Instagram pour Melotones (chansons personnalisées par IA, public africain/diaspora).

${context}

Propose en JSON strict, sans markdown, sans commentaire :
{"headline": "accroche courte et percutante, 2-5 mots max, en français", "subtitle": "phrase courte, 6-12 mots max, en français", "image_description": "description en une phrase du visuel/photo à représenter (ex: type de scène, ambiance) — reste factuel, pas de personne ou marque réelle nommée, pas de scène qui suggère une promesse non tenue par le produit"}`;

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]);
    const raw = result.response.text().trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(raw);
    if (!parsed.headline || !parsed.subtitle || !parsed.image_description) return null;

    const headline = String(parsed.headline).slice(0, 80);
    const subtitle = String(parsed.subtitle).slice(0, 140);
    const imageDescription = String(parsed.image_description).slice(0, 200);

    return { prompt: buildCanvaAIPrompt(headline, subtitle, imageDescription), headline, subtitle };
  } catch (err) {
    console.error('generateCanvaDesignPrompt failed:', err);
    return null;
  }
}
