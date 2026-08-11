import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

async function queryActiveAds() {
  return supabaseAdmin
    .from('ad_campaigns')
    .select('id, advertiser_name, media_url, media_type, target_url')
    .eq('active', true)
    .order('sort_order', { ascending: true });
}

export async function GET() {
  let { data, error } = await queryActiveAds();

  // Incohérence de lecture constatée côté Supabase (réplication) : la même
  // requête renvoie parfois 0 ligne juste après une écriture, sans erreur.
  // Un court nouvel essai suffit généralement à retomber sur une lecture à jour.
  if (!error && (!data || data.length === 0)) {
    await new Promise((r) => setTimeout(r, 300));
    ({ data, error } = await queryActiveAds());
  }

  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}
