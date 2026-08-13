import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Appel REST direct sans cache — même approche que /api/ads, pour la même
// raison (lecture publique qui doit refléter les changements admin sans délai).
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const fsRes = await fetchWithTimeout(
    `${base}/rest/v1/featured_songs?select=generation_id&active=eq.true&order=created_at.desc&limit=5`,
    { headers, cache: 'no-store' },
    8_000
  );
  if (!fsRes.ok) return NextResponse.json(null);
  const featured = await fsRes.json();
  if (!featured.length) return NextResponse.json(null);

  const pick = featured[Math.floor(Math.random() * featured.length)];

  const genRes = await fetchWithTimeout(
    `${base}/rest/v1/generations?select=id,occasion,style,audio_url,cover_url&id=eq.${pick.generation_id}&status=eq.completed`,
    { headers, cache: 'no-store' },
    8_000
  );
  if (!genRes.ok) return NextResponse.json(null);
  const gens = await genRes.json();
  if (!gens.length) return NextResponse.json(null);

  return NextResponse.json(gens[0], { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
