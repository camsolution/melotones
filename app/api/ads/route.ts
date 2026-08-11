import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('ad_campaigns')
    .select('id, advertiser_name, media_url, media_type, target_url')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  console.log('DEBUG /api/ads', {
    data, error,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 24),
    keyLen: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
  });
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}
