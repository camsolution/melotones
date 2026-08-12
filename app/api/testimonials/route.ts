import { NextResponse } from 'next/server';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 600;

export async function POST(request: Request) {
  const supabase = await createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rating, message, consent_public, generation_id } = await request.json();

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: 'Note invalide (1 à 5).' }, { status: 400 });
  }
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMessage || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message requis (max ${MAX_MESSAGE_LENGTH} caractères).` }, { status: 400 });
  }

  // Si un generation_id est fourni, vérifie qu'il appartient bien à l'utilisateur —
  // sinon un avis pourrait être rattaché à la chanson de quelqu'un d'autre.
  let verifiedGenerationId: string | null = null;
  if (typeof generation_id === 'string' && generation_id) {
    const { data: gen } = await supabaseAdmin
      .from('generations')
      .select('id')
      .eq('id', generation_id)
      .eq('user_id', user.id)
      .maybeSingle();
    verifiedGenerationId = gen?.id ?? null;
  }

  const { error } = await supabaseAdmin.from('testimonials').insert({
    user_id: user.id,
    generation_id: verifiedGenerationId,
    rating: ratingNum,
    message: trimmedMessage,
    consent_public: consent_public === true,
    status: 'pending',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submitted: true });
}

// Public : uniquement les avis approuvés ET dont l'auteur a explicitement
// consenti à l'affichage public.
export async function GET() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/testimonials?select=id,rating,message,created_at&status=eq.approved&consent_public=eq.true&order=created_at.desc&limit=12`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return NextResponse.json([], { status: 200 });
  const data = await res.json();
  return NextResponse.json(data);
}
