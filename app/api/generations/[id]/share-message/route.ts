import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateShareMessage } from '@/lib/shareMessageGenerator';
import { checkIpRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership vérifié via le client authentifié (RLS: lecture limitée à ses propres lignes).
  const { data: song } = await supabase.from('generations').select('occasion, style').eq('id', params.id).eq('user_id', user.id).single();
  if (!song) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Limite par IP : chaque clic sur "Générer un mot" coûte un appel Gemini,
  // à protéger comme les autres endpoints IA côté utilisateur (voir
  // /api/generations et /api/chat/send).
  if (!(await checkIpRateLimit(request, 'share-message', { windowMs: 60_000, max: 10 }))) {
    return NextResponse.json({ error: 'Trop de requêtes, réessaie dans une minute.' }, { status: 429 });
  }

  const { lang } = await request.json().catch(() => ({ lang: 'fr' }));
  const resolvedLang = lang === 'en' ? 'en' : 'fr';

  const message = await generateShareMessage(song.occasion, song.style, resolvedLang);
  if (!message) return NextResponse.json({ error: 'Génération indisponible pour le moment' }, { status: 503 });

  return NextResponse.json({ message });
}
