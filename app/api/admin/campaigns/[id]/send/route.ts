import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { sendEmail, unsubscribeUrl, isEmailConfigured, renderCampaignEmail } from '@/lib/email';

type Recipient = { id: string; email: string; firstName: string | null };

function extractFirstName(fullName?: string | null): string | null {
  if (!fullName) return null;
  const first = fullName.trim().split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null;
}

async function listAllUsers(): Promise<Recipient[]> {
  const users: Recipient[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    for (const u of data.users) {
      if (u.email) users.push({ id: u.id, email: u.email, firstName: extractFirstName(u.user_metadata?.full_name || u.user_metadata?.name) });
    }
    if (data.users.length < perPage) break;
    page++;
  }
  return users;
}

async function resolveAudience(audience: string): Promise<Recipient[]> {
  const allUsers = await listAllUsers();
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

  // Compare-and-swap : ne démarre l'envoi que si la campagne est encore un brouillon
  // (ou a échoué et peut être relancée), pour qu'un double-clic ne déclenche pas
  // deux envois à toute la liste.
  const { data: campaign, error: casError } = await supabaseAdmin
    .from('email_campaigns')
    .update({ status: 'sending' })
    .eq('id', params.id)
    .in('status', ['draft', 'failed'])
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
  let lastError: string | null = null;
  for (const recipient of recipients) {
    const html = renderCampaignEmail({
      firstName: recipient.firstName,
      headline: campaign.headline,
      bodyHtml: campaign.body_html,
      ctaLabel: campaign.cta_label,
      ctaUrl: campaign.cta_url,
      promoCode: campaign.promo_code,
      unsubscribeLink: unsubscribeUrl(recipient.id, baseUrl),
    });
    const { ok, error: sendError } = await sendEmail(recipient.email, campaign.subject, html);
    if (ok) sentCount++;
    else lastError = sendError || lastError;
  }

  // Si personne n'a effectivement reçu l'email alors qu'il y avait des destinataires,
  // c'est un échec réel (ex. domaine d'envoi non vérifié chez Resend) — on ne le
  // maquille pas en "envoyée", et on garde le message d'erreur pour diagnostic.
  const allFailed = recipients.length > 0 && sentCount === 0;

  await supabaseAdmin
    .from('email_campaigns')
    .update({
      status: allFailed ? 'failed' : 'sent',
      recipient_count: recipients.length,
      sent_count: sentCount,
      sent_at: new Date().toISOString(),
      error_message: allFailed ? lastError : null,
    })
    .eq('id', params.id);

  return NextResponse.json({ recipientCount: recipients.length, sentCount, error: allFailed ? lastError : undefined });
}
