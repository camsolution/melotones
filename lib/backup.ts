import { supabaseAdmin } from '@/lib/admin';
import { ZipArchive } from 'archiver';

const TABLES = [
  'user_credits', 'generations', 'purchase_requests', 'refund_requests',
  'provider_errors', 'provider_balance', 'pricing_packs', 'coupons', 'partners',
  'chat_conversations', 'chat_messages', 'featured_songs', 'lyrics_generation_log',
  'presence', 'automation_runs',
];

export async function buildBackupZip(): Promise<{ buffer: Buffer; summary: string[] }> {
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

  return { buffer: Buffer.concat(chunks), summary };
}
