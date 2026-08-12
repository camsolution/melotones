import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';
import { verifyCronSecret, getAdminEmail, reportRun } from '@/lib/cron';
import { buildBackupZip } from '@/lib/backup';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 jours

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { buffer, summary } = await buildBackupZip();
    const dateStr = new Date().toISOString().slice(0, 10);
    const path = `melotones-backup-${dateStr}.zip`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('backups')
      .upload(path, buffer, { contentType: 'application/zip', upsert: true });
    if (uploadError) throw new Error(`Upload échoué: ${uploadError.message}`);

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('backups')
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
    if (signError || !signed) throw new Error(`Lien signé échoué: ${signError?.message}`);

    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
    const summaryText = `Sauvegarde envoyée avec succès, ${sizeMb} Mo. ${summary.join(', ')}`;

    const adminEmail = await getAdminEmail();
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        `Sauvegarde Melotones — ${dateStr}`,
        `<p>La sauvegarde hebdomadaire automatique de Melotones est prête (${sizeMb} Mo).</p>
         <p><a href="${signed.signedUrl}">Télécharger la sauvegarde</a> (lien valable 7 jours)</p>
         <p>Pensez à la glisser dans votre Google Drive pour l'archiver : <a href="https://drive.google.com/drive/u/2/home">https://drive.google.com/drive/u/2/home</a></p>
         <p style="color:#888;font-size:12px;">${summary.join('<br>')}</p>`
      );
    }

    await reportRun('backup', 'success', summaryText, { sizeMb, path });
    return NextResponse.json({ ok: true, sizeMb, path });
  } catch (err: any) {
    await reportRun('backup', 'failure', `Échec : ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
