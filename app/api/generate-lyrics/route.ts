import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const COOLDOWN_MS = 5000;

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verrou en base plutôt qu'en mémoire : sur Vercel, deux requêtes
  // consécutives peuvent atterrir sur des instances serverless différentes
  // sans état partagé — un Map en mémoire ne bloque donc rien de fiable.
  const { data: logRow } = await supabaseAdmin
    .from('lyrics_generation_log')
    .select('last_called_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (logRow && Date.now() - new Date(logRow.last_called_at).getTime() < COOLDOWN_MS) {
    return NextResponse.json({ error: 'Merci de patienter quelques secondes avant une nouvelle génération de paroles.' }, { status: 429 });
  }
  await supabaseAdmin.from('lyrics_generation_log').upsert({ user_id: user.id, last_called_at: new Date().toISOString() });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Générateur de paroles non configuré (GEMINI_API_KEY manquant)' }, { status: 500 });
  }

  const { occasion, style, hint } = await request.json();
  if (!occasion || !style) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (String(occasion).length > 400 || String(style).length > 400 || String(hint ?? '').length > 400) {
    return NextResponse.json({ error: 'Field too long' }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `Écris un court texte (3-4 phrases, en français) décrivant le contenu émotionnel d'une chanson personnalisée pour l'occasion "${occasion}" dans un style musical "${style}". ${hint ? `Inspire-toi de cet indice donné par l'utilisateur : "${hint}".` : ''} Le texte doit être chaleureux, précis, mentionner des émotions et suggestions de contenu (sans écrire de vraies paroles avec rimes, juste une description). Réponds uniquement avec le texte, sans préambule.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur génération' }, { status: 500 });
  }
}
