import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('purchase_requests')
    .select('*, user:user_id(email)')
    .order('created_at', { ascending: false });

  if (dbError) {
    // fallback si la jointure auth.users échoue selon la config Supabase
    const { data: raw, error: rawError } = await supabaseAdmin
      .from('purchase_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (rawError) return NextResponse.json({ error: rawError.message }, { status: 500 });
    return NextResponse.json(raw);
  }

  return NextResponse.json(data);
}
