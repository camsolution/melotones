import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { detectLanguage } from '@/lib/languageDetection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text } = await request.json();
  if (typeof text !== 'string' || text.length > 400) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
  }

  const detection = await detectLanguage(text);
  return NextResponse.json({ detection });
}
