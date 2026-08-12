import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const to = url.searchParams.get('to') || 'verify-j0-debug@example.com';
  const result = await sendEmail(to, 'Diagnostic Melotones', '<p>test</p>');
  return NextResponse.json(result);
}
