import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildBackupZip } from '@/lib/backup';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Clé dédiée à cet usage précis (export manuel) — délibérément distincte
// de SUPABASE_SERVICE_ROLE_KEY : si jamais elle fuit, elle ne permet que de
// déclencher un export, jamais de lire/écrire directement dans la base.
function isAuthorized(request: Request): boolean {
  const expected = process.env.BACKUP_EXPORT_SECRET;
  if (!expected) return false;
  const url = new URL(request.url);
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { buffer } = await buildBackupZip();
  const filename = `melotones-backup-${new Date().toISOString().slice(0, 10)}.zip`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
