import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';
import crypto from 'crypto';
import { ZipArchive } from 'archiver';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TABLES = [
  'user_credits', 'generations', 'purchase_requests', 'refund_requests',
  'provider_errors', 'provider_balance', 'pricing_packs', 'coupons', 'partners',
  'chat_conversations', 'chat_messages', 'featured_songs', 'lyrics_generation_log',
  'presence',
];

// Clé dédiée à cet usage précis (routine de sauvegarde) — délibérément distincte
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

  const archive = new ZipArchive({ zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve());
    archive.on('error', reject);
  });

  const summary: string[] = [];

  for (const table of TABLES) {
    const { data, error } = await supabaseAdmin.from(table).select('*');
    if (error) continue;
    archive.append(JSON.stringify(data, null, 2), { name: `db/${table}.json` });
    summary.push(`${table}: ${data.length} lignes`);
  }

  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const usersExport = users.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }));
  archive.append(JSON.stringify(usersExport, null, 2), { name: 'db/auth_users.json' });
  summary.push(`auth_users: ${usersExport.length} lignes`);

  for (const bucket of ['songs', 'covers']) {
    const { data: folders } = await supabaseAdmin.storage.from(bucket).list('', { limit: 1000 });
    let fileCount = 0;
    for (const folder of folders || []) {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(folder.name, { limit: 1000 });
      for (const f of files || []) {
        if (!f.metadata) continue;
        const fullPath = `${folder.name}/${f.name}`;
        const { data: blob, error } = await supabaseAdmin.storage.from(bucket).download(fullPath);
        if (error || !blob) continue;
        const buf = Buffer.from(await blob.arrayBuffer());
        archive.append(buf, { name: `storage/${bucket}/${fullPath}` });
        fileCount++;
      }
    }
    summary.push(`storage/${bucket}: ${fileCount} fichiers`);
  }

  archive.append(`Sauvegarde Melotones — ${new Date().toISOString()}\n\n${summary.join('\n')}`, { name: 'README.txt' });

  archive.finalize();
  await done;

  const zipBuffer = Buffer.concat(chunks);
  const filename = `melotones-backup-${new Date().toISOString().slice(0, 10)}.zip`;

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
    },
  });
}
