import { NextResponse } from 'next/server';
import { supabaseAdmin, verifyAutomationSecret } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const VALID_STATUS = ['success', 'alert', 'failure'];

export async function POST(request: Request) {
  if (!verifyAutomationSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { agent_slug, status, summary, details } = await request.json();

  if (typeof agent_slug !== 'string' || !agent_slug || !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: 'agent_slug and a valid status are required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('automation_runs').insert({
    agent_slug: agent_slug.slice(0, 64),
    status,
    summary: typeof summary === 'string' ? summary.slice(0, 2000) : null,
    details: details ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logged: true });
}
