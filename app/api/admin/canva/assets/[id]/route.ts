import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// États du cycle de vie d'un asset (section 21 de la mission). Changer le
// statut ici est une étiquette posée manuellement par un humain — aucun
// mécanisme n'exporte, ne programme ni ne publie réellement quoi que ce soit
// (P4 : réseaux sociaux non connectés). SCHEDULED/PUBLISHED ne signifient
// donc pas "programmé/publié en vrai", juste "marqué comme tel par l'admin".
const VALID_STATUSES = [
  'DISCOVERED', 'CLASSIFIED', 'DRAFT', 'READY_FOR_REVIEW', 'APPROVED',
  'EXPORTING', 'EXPORTED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED',
  'REJECTED', 'MANUAL_UPLOAD_REQUIRED',
];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const { status: newStatus, platform, campaign, language } = await request.json();

  const update: Record<string, string> = {};
  if (newStatus !== undefined) {
    if (!VALID_STATUSES.includes(newStatus)) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    update.status = newStatus;
  }
  if (platform !== undefined) update.platform = String(platform).slice(0, 100);
  if (campaign !== undefined) update.campaign = String(campaign).slice(0, 100);
  if (language !== undefined) update.language = String(language).slice(0, 10);

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });

  const { error: updateError } = await supabaseAdmin.from('content_assets').update(update).eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
