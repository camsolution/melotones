import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';
import { verifyUnsubscribeToken } from '@/lib/email';

function page(title: string, message: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .box{background:#fff;padding:32px 40px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;max-width:400px}
  h1{font-size:18px;color:#111827}p{color:#6b7280;font-size:14px}</style></head>
  <body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user');
  const token = url.searchParams.get('token');

  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) {
    return new NextResponse(page('Lien invalide', "Ce lien de désinscription n'est pas valide."), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  await supabaseAdmin.from('email_unsubscribes').upsert({ user_id: userId });

  return new NextResponse(
    page('Désinscription confirmée', "Vous ne recevrez plus nos emails marketing. Vous pouvez toujours utiliser votre compte Melotones normalement."),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
