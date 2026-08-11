import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('ad_campaigns')
    .select('id, advertiser_name, media_url, media_type, target_url')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  const unfiltered = await supabaseAdmin.from('ad_campaigns').select('*');
  const countRes = await supabaseAdmin.from('ad_campaigns').select('*', { count: 'exact', head: true });
  const partnersCheck = await supabaseAdmin.from('partners').select('*');

  console.log('DEBUG /api/ads', {
    data, error,
    unfiltered: unfiltered.data, unfilteredError: unfiltered.error,
    count: countRes.count, countError: countRes.error,
    partnersCount: partnersCheck.data?.length, partnersError: partnersCheck.error,
  });
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}
