import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { generateMusic } from '@/lib/music-generator';
import { styleDescriptors } from '@/lib/styleDescriptors';
import { autoRefund } from '@/lib/refunds';

const MAX_FIELD_LENGTH = 400;
const GENERATION_COOLDOWN_MS = 20_000;

const VOICE_LANGUAGE_NAMES: Record<string, string> = { fr: 'French', en: 'English' };
const PROMPT_MAX_LENGTH = 295; // MusicGPT rejette music_style au-delà de 300 caractères

function truncateToWordBoundary(text: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
}

// La clause de langue est obligatoire et ne doit jamais être coupée. Le style
// musical prime ensuite sur le message libre pour la qualité du résultat : si le
// prompt dépasse la limite de MusicGPT, on tronque d'abord le message, puis le
// descriptif de style si ça ne suffit toujours pas.
function buildPrompt(style: string, occasion: string, voiceLanguage: string, message: string): string {
  const scaffold = (s: string, m: string) =>
    `A ${s} song for ${occasion}, sung entirely in ${voiceLanguage}.${m ? ` About: ${m}` : ''}`;

  let styleText = style;
  let messageText = message;
  let prompt = scaffold(styleText, messageText);

  if (prompt.length > PROMPT_MAX_LENGTH) {
    const overBy = prompt.length - PROMPT_MAX_LENGTH;
    messageText = truncateToWordBoundary(messageText, messageText.length - overBy);
    prompt = scaffold(styleText, messageText);
  }
  if (prompt.length > PROMPT_MAX_LENGTH) {
    const overBy = prompt.length - PROMPT_MAX_LENGTH;
    styleText = truncateToWordBoundary(styleText, styleText.length - overBy);
    prompt = scaffold(styleText, messageText);
  }
  return prompt;
}

async function refundCredit(userId: string) {
  const { data: fresh } = await supabaseAdmin.from('user_credits').select('balance').eq('user_id', userId).single();
  if (fresh) {
    await supabaseAdmin.from('user_credits').update({ balance: fresh.balance + 1 }).eq('user_id', userId);
  }
}

export async function POST(request: Request) {
  // Le client cookie-based sert uniquement à vérifier QUI fait la requête.
  // Toutes les lectures/écritures sur user_credits et generations passent
  // ensuite par supabaseAdmin (service role) : la validation (solde, cooldown,
  // ownership) vit exclusivement côté code serveur, jamais dans des policies
  // RLS accordant un accès direct en écriture au client.
  const authClient = createServerClientWithCookies();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { occasion, style, custom_message, voice_gender } = await request.json();
  if (!occasion || !style || !custom_message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (
    String(occasion).length > MAX_FIELD_LENGTH ||
    String(style).length > MAX_FIELD_LENGTH ||
    String(custom_message).length > MAX_FIELD_LENGTH
  ) {
    return NextResponse.json({ error: 'Field too long' }, { status: 400 });
  }

  const { count: recentCount } = await supabaseAdmin
    .from('generations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - GENERATION_COOLDOWN_MS).toISOString());
  if ((recentCount ?? 0) > 0) {
    return NextResponse.json({ error: 'Merci de patienter quelques secondes avant une nouvelle génération.' }, { status: 429 });
  }

  let { data: creditRow, error: creditError } = await supabaseAdmin
    .from('user_credits')
    .select('balance, is_admin, language')
    .eq('user_id', user.id)
    .single();

  if (creditError || !creditRow) {
    const { error: insertError } = await supabaseAdmin
      .from('user_credits')
      .insert({ user_id: user.id, balance: 3 });
    if (insertError) return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 });
    creditRow = { balance: 3, is_admin: false, language: 'fr' };
  }

  const isAdmin = creditRow.is_admin === true;

  if (!isAdmin) {
    if (creditRow.balance < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    // Compare-and-swap: n'affecte une ligne que si le solde n'a pas changé
    // depuis la lecture ci-dessus — évite qu'une double-soumission concurrente
    // ne fasse générer deux chansons pour une seule Note déduite.
    const { data: deducted, error: deductError } = await supabaseAdmin
      .from('user_credits')
      .update({ balance: creditRow.balance - 1 })
      .eq('user_id', user.id)
      .eq('balance', creditRow.balance)
      .select()
      .single();
    if (deductError || !deducted) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
  }

  const { data: generation, error: insertError } = await supabaseAdmin
    .from('generations')
    .insert({ user_id: user.id, occasion, style, custom_message, voice_gender: voice_gender || null, status: 'queued' })
    .select()
    .single();

  if (insertError || !generation) {
    if (!isAdmin) await refundCredit(user.id);
    return NextResponse.json({ error: 'Failed to create generation' }, { status: 500 });
  }

  try {
    const styleKey = style.toLowerCase().replace(/[^a-z]/g, '');
    const enrichedStyle = styleDescriptors[styleKey] || style;
    // La langue des voix suit obligatoirement la langue du profil de l'utilisateur
    // (jamais un choix libre au moment de la génération) — c'est la seule façon de
    // le garantir, l'API MusicGPT n'ayant pas de paramètre de langue dédié.
    const voiceLanguage = VOICE_LANGUAGE_NAMES[creditRow.language] || 'French';
    const prompt = buildPrompt(enrichedStyle, occasion, voiceLanguage, custom_message);

    const genderParam = voice_gender === 'male' || voice_gender === 'female' || voice_gender === 'duet' ? voice_gender : undefined;
    const { predictionId } = await generateMusic(prompt, user.id, genderParam);

    await supabaseAdmin
      .from('generations')
      .update({ prediction_id: predictionId, status: 'processing' })
      .eq('id', generation.id);

    return NextResponse.json({ id: generation.id, status: 'processing' });
  } catch (err: any) {
    console.error('Generation launch error:', err);
    await supabaseAdmin.from('generations').update({ status: 'failed' }).eq('id', generation.id);
    // Le fournisseur a rejeté/échoué la requête de lancement : c'est une panne
    // technique avérée (pas une simple lenteur), donc remboursement automatique.
    if (!isAdmin) await autoRefund(generation.id, user.id, err.message || 'Échec du lancement de la génération chez le fournisseur');
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}
