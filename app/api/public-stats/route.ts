import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REST_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const AUTH_HEADERS = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  Prefer: 'count=exact',
};

function countFromContentRange(res: Response): number {
  const range = res.headers.get('content-range');
  return range ? Number(range.split('/')[1] ?? 0) : 0;
}

// Compteurs publics affichés sur la page d'accueil — agrégats non sensibles
// uniquement (pas d'email, pas de contenu). Lu via PostgREST direct + cache
// 'no-store' (pas via supabase-js) : constaté sur ce projet que Next.js peut
// mettre en cache les fetch() internes de supabase-js malgré force-dynamic,
// servant des chiffres obsolètes après une mise à jour en base.
export async function GET() {
  const [usersRes, songsRes] = await Promise.all([
    fetch(`${REST_URL}/user_credits?select=user_id&limit=1`, { cache: 'no-store', headers: AUTH_HEADERS }),
    fetch(`${REST_URL}/generations?select=id&status=eq.completed&limit=1`, { cache: 'no-store', headers: AUTH_HEADERS }),
  ]);

  return NextResponse.json({
    totalUsers: countFromContentRange(usersRes),
    totalSongs: countFromContentRange(songsRes),
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
