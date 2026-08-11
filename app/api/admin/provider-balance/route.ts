import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { computeProviderBalanceEstimate } from '@/lib/providerBalance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  return NextResponse.json(await computeProviderBalanceEstimate());
}

export async function PATCH(request: Request) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { topped_up_usd, cost_per_generation_usd } = await request.json();
  if (typeof topped_up_usd !== 'number' || topped_up_usd < 0) {
    return NextResponse.json({ error: 'Montant rechargé invalide' }, { status: 400 });
  }
  if (typeof cost_per_generation_usd !== 'number' || cost_per_generation_usd < 0) {
    return NextResponse.json({ error: 'Coût par génération invalide' }, { status: 400 });
  }

  // Un nouveau rechargement réinitialise le point de départ du décompte —
  // topped_up_at = maintenant, pour ne compter que la consommation à venir.
  const { error: dbError } = await supabaseAdmin
    .from('provider_balance')
    .upsert({
      provider: 'musicgpt',
      topped_up_usd,
      cost_per_generation_usd,
      topped_up_at: new Date().toISOString(),
      updated_by: user!.id,
    });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(await computeProviderBalanceEstimate());
}
