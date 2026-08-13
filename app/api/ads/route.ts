import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Appel REST direct (plutôt que le client supabase-js) avec cache
// explicitement désactivé : élimine toute ambiguïté sur une éventuelle
// mise en cache de la requête, quelle qu'en soit la couche.
export async function GET() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ad_campaigns?select=id,advertiser_name,media_url,media_type,target_url&active=eq.true&order=sort_order.asc`;

  const res = await fetchWithTimeout(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: 'no-store',
  }, 8_000);

  if (!res.ok) return NextResponse.json([]);
  const data = await res.json();
  return NextResponse.json(data || [], { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
