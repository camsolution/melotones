import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('ad_campaigns')
    .select('id, advertiser_name, media_url, media_type, target_url')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}
