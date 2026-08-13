import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';

// supabase-js passe par fetch(), que Next.js met parfois en cache côté serveur
// même avec force-dynamic (constaté en prod sur ce projet — voir /api/generate-lyrics) :
// on lit directement PostgREST avec cache: 'no-store' pour être sûr d'avoir les
// données à jour à chaque appel, notamment après une modification admin des tarifs.
export async function GET() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/pricing_packs?select=*&active=eq.true&order=sort_order.asc`;
  const res = await fetchWithTimeout(url, {
    cache: 'no-store',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }, 8_000);

  if (!res.ok) return NextResponse.json({ error: 'Failed to load pricing' }, { status: 500 });
  const data = await res.json();
  return NextResponse.json(data);
}
