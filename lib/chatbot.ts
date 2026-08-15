import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/admin';
import { styleMeta } from '@/lib/styleMeta';

const ESCALATE_MARKER = 'ESCALADE_HUMAIN';
const ESCALATION_KEYWORDS = ['humain', 'agent', 'quelqu\'un', 'un conseiller', 'un responsable', 'un administrateur', 'parler à une personne'];

export function userRequestsHuman(message: string): boolean {
  const lower = message.toLowerCase();
  return ESCALATION_KEYWORDS.some((k) => lower.includes(k));
}

async function buildContext(): Promise<string> {
  const { data: packs } = await supabaseAdmin
    .from('pricing_packs')
    .select('label, credits, price_fcfa')
    .eq('active', true)
    .order('sort_order');

  const pricingLines = (packs || [])
    .map((p) => `- ${p.label} : ${p.credits} Chansons pour ${p.price_fcfa.toLocaleString('fr-FR')} FCFA`)
    .join('\n');

  const styles = Object.keys(styleMeta).join(', ');

  return `Tu es l'assistant support de Melotones, une application qui génère des chansons personnalisées par IA pour toutes occasions (anniversaire, mariage, cadeau, etc.), avec des styles africains et internationaux.

Comment ça marche : l'utilisateur choisit une occasion, un style musical, écrit un message ou des indications, et l'IA génère une chanson complète (1 crédit "Chanson" par titre généré). Les Chansons s'achètent via le dashboard (menu "Chansons"), paiement instantané par Mobile Money ou carte via PayDunya.

Styles musicaux disponibles : ${styles}.

Tarifs actuels :
${pricingLines}

Si une génération échoue (problème technique côté fournisseur), l'utilisateur ne perd pas sa Chanson : une demande de remboursement est automatiquement créée et un administrateur l'approuve manuellement.

Réponds toujours en français, de façon chaleureuse, concise (3-4 phrases maximum), et précise. Ne donne jamais d'information que tu ne connais pas avec certitude — dans ce cas, ou si la question sort de ce périmètre (réclamation sensible, remboursement contesté, problème de paiement bloquant, demande explicite de parler à un humain), réponds UNIQUEMENT par le mot "${ESCALATE_MARKER}" (rien d'autre) pour transférer la conversation à l'équipe.`;
}

export async function generateBotReply(userMessage: string, history: { sender: string; content: string }[]): Promise<{ reply: string; escalate: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { reply: '', escalate: true };

  if (userRequestsHuman(userMessage)) return { reply: '', escalate: true };

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const systemContext = await buildContext();

  const conversationText = history
    .slice(-8)
    .map((m) => `${m.sender === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const prompt = `${systemContext}\n\nHistorique récent de la conversation :\n${conversationText}\n\nNouveau message de l'utilisateur : "${userMessage}"\n\nTa réponse :`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (text.includes(ESCALATE_MARKER)) return { reply: '', escalate: true };
    return { reply: text, escalate: false };
  } catch (err) {
    console.error('Chatbot generation error:', err);
    return { reply: '', escalate: true };
  }
}
