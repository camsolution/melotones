import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { generateMusic } from '@/lib/music-generator';
import { autoRefund } from '@/lib/refunds';
import { VOICE_LANGUAGE_NAMES, computeMessageBudget, buildPrompt } from '@/lib/promptBudget';
import { logProviderError, localizeProviderError, isProviderOutOfCredits } from '@/lib/providerErrors';

const MAX_FIELD_LENGTH = 400;
const GENERATION_COOLDOWN_MS = 20_000;

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
  const authClient = await createServerClientWithCookies();
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

  // Ces deux lectures sont indépendantes (aucune ne dépend du résultat de
  // l'autre) — les lancer en parallèle économise un aller-retour réseau complet
  // vers Supabase sur le chemin critique de chaque génération.
  const [{ count: recentCount }, { data: creditRowResult, error: creditError }] = await Promise.all([
    supabaseAdmin
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - GENERATION_COOLDOWN_MS).toISOString()),
    supabaseAdmin
      .from('user_credits')
      .select('balance, is_admin, language')
      .eq('user_id', user.id)
      .single(),
  ]);
  if ((recentCount ?? 0) > 0) {
    return NextResponse.json({ error: 'Merci de patienter quelques secondes avant une nouvelle génération.' }, { status: 429 });
  }

  let creditRow = creditRowResult;

  if (creditError || !creditRow) {
    const { error: insertError } = await supabaseAdmin
      .from('user_credits')
      .insert({ user_id: user.id, balance: 0 });
    if (insertError) return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 });
    creditRow = { balance: 0, is_admin: false, language: 'fr' };
  }

  const isAdmin = creditRow.is_admin === true;

  // Coupe-circuit : évite de faire payer/attendre un utilisateur pour une
  // génération vouée à échouer si le fournisseur vient de signaler qu'il est
  // à sec (voir isProviderOutOfCredits) — l'admin reste exempté pour pouvoir
  // vérifier immédiatement après un rechargement, sans attendre la fenêtre.
  if (!isAdmin && await isProviderOutOfCredits()) {
    return NextResponse.json({
      error: localizeProviderError('INSUFFICIENT_CREDITS', creditRow.language),
    }, { status: 503 });
  }

  // La longueur autorisée pour le message dépend du style choisi (les descriptifs
  // de style les plus détaillés laissent moins de place avant la limite de
  // MusicGPT) — on bloque ici plutôt que de tronquer silencieusement, pour rester
  // cohérent avec la jauge affichée à l'utilisateur au moment de la saisie.
  const voiceLanguage = VOICE_LANGUAGE_NAMES[creditRow.language] || 'French';
  const { min: minMessageLength, max: maxMessageLength } = computeMessageBudget(style, occasion, voiceLanguage);
  if (String(custom_message).length < minMessageLength || String(custom_message).length > maxMessageLength) {
    return NextResponse.json({
      error: `Le message doit contenir entre ${minMessageLength} et ${maxMessageLength} caractères pour ce style.`,
      min: minMessageLength,
      max: maxMessageLength,
    }, { status: 400 });
  }

  if (!isAdmin) {
    if (creditRow.balance < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    // Compare-and-swap: n'affecte une ligne que si le solde n'a pas changé
    // depuis la lecture ci-dessus — évite qu'une double-soumission concurrente
    // ne fasse générer deux titres pour une seule Chanson déduite.
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
    const prompt = buildPrompt(style, occasion, voiceLanguage, custom_message);

    const genderParam = voice_gender === 'male' || voice_gender === 'female' || voice_gender === 'duet' ? voice_gender : undefined;
    const { predictionId } = await generateMusic(prompt, user.id, genderParam);

    await supabaseAdmin
      .from('generations')
      .update({ prediction_id: predictionId, status: 'processing' })
      .eq('id', generation.id);

    return NextResponse.json({ id: generation.id, status: 'processing' });
  } catch (err: any) {
    console.error('Generation launch error:', err);
    const rawMessage = err.message || 'Unknown provider error';
    await supabaseAdmin.from('generations').update({ status: 'failed', failure_reason: rawMessage }).eq('id', generation.id);
    // Toujours loggé (même pour un compte admin) pour que l'alerte remonte au
    // dashboard admin, indépendamment du remboursement.
    await logProviderError(generation.id, user.id, rawMessage);
    // Le fournisseur a rejeté/échoué la requête de lancement : c'est une panne
    // technique avérée (pas une simple lenteur), donc remboursement automatique.
    if (!isAdmin) await autoRefund(generation.id, user.id, rawMessage);
    return NextResponse.json({ error: localizeProviderError(rawMessage, creditRow.language) }, { status: 500 });
  }
}
