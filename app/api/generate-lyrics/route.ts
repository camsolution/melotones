import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
