import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const attempt1 = await supabaseAdmin.from('ad_campaigns').select('*').eq('active', true);
  const attempt2 = await supabaseAdmin.from('ad_campaigns').select('*').eq('active', true);
  const attempt3 = await supabaseAdmin.from('ad_campaigns').select('*').eq('active', true);
  const filterOnly = await supabaseAdmin.from('ad_campaigns').select('id, active').eq('active', true);
  const eqFalse = await supabaseAdmin.from('ad_campaigns').select('id').eq('active', false);

  console.log('DEBUG /api/ads flakiness check', {
    attempt1: attempt1.data?.length, attempt2: attempt2.data?.length, attempt3: attempt3.data?.length,
    filterOnly: filterOnly.data, filterOnlyError: filterOnly.error,
    eqFalseCount: eqFalse.data?.length, eqFalseError: eqFalse.error,
  });

  const { data, error } = await supabaseAdmin
    .from('ad_campaigns')
    .select('id, advertiser_name, media_url, media_type, target_url')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}
