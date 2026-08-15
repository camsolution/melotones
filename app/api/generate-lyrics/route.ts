import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { VOICE_LANGUAGE_NAMES, computeMessageBudget, truncateToWordBoundary } from '@/lib/promptBudget';

export const dynamic = 'force-dynamic';

const COOLDOWN_MS = 5000;

export async function POST(request: Request) {
  const supabase = await createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verrou en base plutôt qu'en mémoire : sur Vercel, deux requêtes
  // consécutives peuvent atterrir sur des instances serverless différentes
  // sans état partagé. fetch brut avec cache désactivé plutôt que le client
  // supabase-js, par cohérence avec /api/ads et /api/featured-song.
  const restHeaders = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const logRes = await fetchWithTimeout(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/lyrics_generation_log?select=last_called_at&user_id=eq.${user.id}`,
    { headers: restHeaders, cache: 'no-store' },
    8_000
  );
  const logRows = logRes.ok ? await logRes.json() : [];
  if (logRows[0] && Date.now() - new Date(logRows[0].last_called_at).getTime() < COOLDOWN_MS) {
    return NextResponse.json({ error: 'Merci de patienter quelques secondes avant une nouvelle génération de paroles.' }, { status: 429 });
  }
  await fetchWithTimeout(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/lyrics_generation_log`, {
    method: 'POST',
    headers: { ...restHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: user.id, last_called_at: new Date().toISOString() }),
    cache: 'no-store',
  }, 8_000);

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

  // La langue de cette suggestion doit suivre la langue du compte (celle qui
  // pilotera aussi la voix chantée) plutôt qu'être figée — sinon un compte EN
  // reçoit un texte français qu'il devra lui-même retraduire.
  const { data: creditRow } = await supabaseAdmin
    .from('user_credits')
    .select('language')
    .eq('user_id', user.id)
    .single();
  const language: 'fr' | 'en' = creditRow?.language === 'en' ? 'en' : 'fr';

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Le texte généré alimente directement le champ "message" du formulaire, dont
  // la taille max dépend du style/occasion (voir lib/promptBudget.ts — un style
  // déjà très décrit comme Arabic ou Cabo Love laisse moins de marge). On donne
  // donc ce budget à Gemini en amont pour éviter de générer un texte que
  // l'utilisateur devrait ensuite raccourcir lui-même, avec une troncature au
  // mot le plus proche en filet de sécurité si Gemini le dépasse malgré tout.
  const voiceLanguage = VOICE_LANGUAGE_NAMES[language] || 'French';
  const { max: maxLength } = computeMessageBudget(style, occasion, voiceLanguage);

  const prompt = language === 'en'
    ? `Write a short text (in English) describing the emotional content of a personalized song for the occasion "${occasion}" in a "${style}" musical style. ${hint ? `Draw inspiration from this hint given by the user: "${hint}".` : ''} The text should be warm, specific, mention emotions and content suggestions (without writing actual rhyming lyrics, just a description). It MUST be at most ${maxLength} characters, including spaces — stay comfortably under that limit rather than getting cut off mid-sentence. Reply with only the text, no preamble.`
    : `Écris un court texte (en français) décrivant le contenu émotionnel d'une chanson personnalisée pour l'occasion "${occasion}" dans un style musical "${style}". ${hint ? `Inspire-toi de cet indice donné par l'utilisateur : "${hint}".` : ''} Le texte doit être chaleureux, précis, mentionner des émotions et suggestions de contenu (sans écrire de vraies paroles avec rimes, juste une description). Il doit impérativement tenir en ${maxLength} caractères maximum, espaces compris — reste confortablement sous cette limite plutôt que de risquer une coupure en milieu de phrase. Réponds uniquement avec le texte, sans préambule.`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    const text = rawText.length > maxLength ? truncateToWordBoundary(rawText, maxLength) : rawText;
    return NextResponse.json({ text, maxLength });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur génération' }, { status: 500 });
  }
}
