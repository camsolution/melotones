import { supabaseAdmin } from '@/lib/admin';

export async function computeProviderBalanceEstimate() {
  const { data: row } = await supabaseAdmin
    .from('provider_balance')
    .select('*')
    .eq('provider', 'musicgpt')
    .maybeSingle();

  if (!row) {
    return { toppedUpUsd: 0, costPerGenerationUsd: 0, toppedUpAt: null, consumedSinceTopUp: 0, estimatedRemainingUsd: 0, estimatedRemainingGenerations: null as number | null };
  }

  // "Consommé" = générations réellement soumises au fournisseur (prediction_id
  // renseigné), quel que soit leur résultat final — meilleure approximation de
  // l'usage réel de crédits chez MusicGPT, qui n'expose aucune API de solde
  // (vérifié dans leur documentation).
  const { count } = await supabaseAdmin
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .not('prediction_id', 'is', null)
    .gte('created_at', row.topped_up_at);

  const consumed = count ?? 0;
  const consumedUsd = consumed * (row.cost_per_generation_usd || 0);
  const estimatedRemainingUsd = Math.max(0, row.topped_up_usd - consumedUsd);
  const estimatedRemainingGenerations = row.cost_per_generation_usd > 0
    ? Math.floor(estimatedRemainingUsd / row.cost_per_generation_usd)
    : null;

  return {
    toppedUpUsd: row.topped_up_usd,
    costPerGenerationUsd: row.cost_per_generation_usd,
    toppedUpAt: row.topped_up_at,
    consumedSinceTopUp: consumed,
    estimatedRemainingUsd,
    estimatedRemainingGenerations,
  };
}
