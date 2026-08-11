import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { sendEmail, unsubscribeUrl, isEmailConfigured } from '@/lib/email';

async function listAllUserEmails(): Promise<{ id: string; email: string }[]> {
  const users: { id: string; email: string }[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    for (const u of data.users) if (u.email) users.push({ id: u.id, email: u.email });
    if (data.users.length < perPage) break;
    page++;
  }
  return users;
}

async function resolveAudience(audience: string): Promise<{ id: string; email: string }[]> {
  const allUsers = await listAllUserEmails();
  if (audience === 'all') return allUsers;

  const { data: gens } = await supabaseAdmin.from('generations').select('user_id');
  const activeIds = new Set((gens || []).map((g) => g.user_id));

  return audience === 'active' ? allUsers.filter((u) => activeIds.has(u.id)) : allUsers.filter((u) => !activeIds.has(u.id));
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Emailing non configuré : ajoutez RESEND_API_KEY et RESEND_FROM_EMAIL dans les variables d'environnement Vercel." }, { status: 503 });
  }

  // Compare-and-swap : ne démarre l'envoi que si la campagne est encore un brouillon,
  // pour qu'un double-clic ne déclenche pas deux envois à toute la liste.
  const { data: campaign, error: casError } = await supabaseAdmin
    .from('email_campaigns')
    .update({ status: 'sending' })
    .eq('id', params.id)
    .eq('status', 'draft')
    .select()
    .single();

  if (casError || !campaign) {
    return NextResponse.json({ error: 'Campagne introuvable ou déjà envoyée' }, { status: 409 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const { data: unsubRows } = await supabaseAdmin.from('email_unsubscribes').select('user_id');
  const unsubscribed = new Set((unsubRows || []).map((r) => r.user_id));

  const recipients = (await resolveAudience(campaign.audience)).filter((u) => !unsubscribed.has(u.id));

  let sentCount = 0;
  for (const recipient of recipients) {
    const footer = `<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"><p style="font-size:12px;color:#9ca3af">Melotones — <a href="${unsubscribeUrl(recipient.id, baseUrl)}" style="color:#9ca3af">Se désinscrire</a></p>`;
    const { ok } = await sendEmail(recipient.email, campaign.subject, campaign.body_html + footer);
    if (ok) sentCount++;
  }

  await supabaseAdmin
    .from('email_campaigns')
    .update({ status: 'sent', recipient_count: recipients.length, sent_count: sentCount, sent_at: new Date().toISOString() })
    .eq('id', params.id);

  return NextResponse.json({ recipientCount: recipients.length, sentCount });
}
