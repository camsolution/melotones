import { GoogleGenerativeAI } from '@google/generative-ai';

export type DetectedPerson = { name: string; confidence: number };

// MELOTONES_PERSON_DETECTION : suggestion d'inclusion, jamais automatique —
// l'utilisateur confirme toujours explicitement (voir CreateForm). En cas
// d'échec/timeout, retourne une liste vide : le message libre reste utilisable
// tel quel, rien n'est bloqué.
export async function detectPersons(text: string): Promise<DetectedPerson[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text || text.trim().length < 4) return [];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Extract real personal names (first name, first+last name, or clear contextual nickname referring to a real person) from this text. Text is likely French or English, possibly African/diaspora names with accents or compound forms.

Do NOT extract: brand names, city/country names, religions, organizations, fictional characters, or ambiguous common words. When in doubt, omit it.

Reply with ONLY a compact JSON array, no markdown, no code fence, no explanation: [{"name": "...", "confidence": <0 to 1>}]. Return [] if no real person name is found.

Text: "${text.slice(0, 500)}"`;

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6_000)),
    ]);
    const raw = result.response.text().trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.name === 'string' && p.name.trim())
      .slice(0, 3)
      .map((p) => ({ name: p.name.trim(), confidence: typeof p.confidence === 'number' ? p.confidence : 0.5 }));
  } catch {
    return [];
  }
}
