import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { isCanvaConfigured, getCanvaConnectionStatus } from '@/lib/canva';
import { isTiktokConfigured, getTiktokConnectionStatus } from '@/lib/tiktok';
import { isMetaConfigured, getMetaConnectionStatus } from '@/lib/meta';
import { isYoutubeConfigured, getYoutubeConnectionStatus } from '@/lib/youtube';
import { isPayDunyaConfigured } from '@/lib/payments/paydunya';
import { isEmailConfigured } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Vue consolidée de tous les identifiants de services tiers utilisés par
// Melotones — jamais les valeurs elles-mêmes, seulement statut/expiration/
// erreur, pour donner à l'admin un seul endroit où voir ce qui est configuré,
// connecté ou cassé, sans dupliquer les secrets hors des env vars Vercel
// (qui restent la seule source de vérité — voir CLAUDE.md).
type CredentialEntry = {
  key: string;
  label: string;
  kind: 'oauth' | 'apikey';
  configured: boolean;
  connected?: boolean;
  expiresAt?: string | null;
  lastRefreshedAt?: string | null;
  lastError?: string | null;
  envVars: string[];
  rotateUrl: string;
};

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const [canva, tiktok, meta, youtube] = await Promise.all([
    isCanvaConfigured() ? getCanvaConnectionStatus() : null,
    isTiktokConfigured() ? getTiktokConnectionStatus() : null,
    isMetaConfigured() ? getMetaConnectionStatus() : null,
    isYoutubeConfigured() ? getYoutubeConnectionStatus() : null,
  ]);

  const entries: CredentialEntry[] = [
    {
      key: 'canva', label: 'Canva', kind: 'oauth',
      configured: isCanvaConfigured(), connected: canva?.connected ?? false,
      expiresAt: canva?.expiresAt ?? null, lastRefreshedAt: canva?.lastRefreshedAt ?? null, lastError: canva?.lastError ?? null,
      envVars: ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI'],
      rotateUrl: 'https://www.canva.com/developers/apps',
    },
    {
      key: 'tiktok', label: 'TikTok', kind: 'oauth',
      configured: isTiktokConfigured(), connected: tiktok?.connected ?? false,
      expiresAt: tiktok?.expiresAt ?? null, lastRefreshedAt: tiktok?.lastRefreshedAt ?? null, lastError: tiktok?.lastError ?? null,
      envVars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'],
      rotateUrl: 'https://developers.tiktok.com/apps',
    },
    {
      key: 'meta', label: 'Meta (Facebook/Instagram)', kind: 'oauth',
      configured: isMetaConfigured(), connected: meta?.connected ?? false,
      expiresAt: meta?.expiresAt ?? null, lastRefreshedAt: meta?.lastRefreshedAt ?? null, lastError: meta?.lastError ?? null,
      envVars: ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'],
      rotateUrl: 'https://developers.facebook.com/apps',
    },
    {
      key: 'youtube', label: 'YouTube', kind: 'oauth',
      configured: isYoutubeConfigured(), connected: youtube?.connected ?? false,
      expiresAt: youtube?.expiresAt ?? null, lastRefreshedAt: youtube?.lastRefreshedAt ?? null, lastError: youtube?.lastError ?? null,
      envVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI'],
      rotateUrl: 'https://console.cloud.google.com/apis/credentials',
    },
    {
      key: 'musicgpt', label: 'MusicGPT', kind: 'apikey',
      configured: !!process.env.MUSICGPT_API_KEY && !!process.env.MUSICGPT_WEBHOOK_SECRET,
      envVars: ['MUSICGPT_API_KEY', 'MUSICGPT_WEBHOOK_SECRET'],
      rotateUrl: 'https://musicgpt.com',
    },
    {
      key: 'paydunya', label: 'PayDunya', kind: 'apikey',
      configured: isPayDunyaConfigured(),
      envVars: ['PAYDUNYA_MASTER_KEY', 'PAYDUNYA_PRIVATE_KEY', 'PAYDUNYA_PUBLIC_KEY', 'PAYDUNYA_TOKEN'],
      rotateUrl: 'https://app.paydunya.com/account/api',
    },
    {
      key: 'resend', label: 'Resend (email)', kind: 'apikey',
      configured: isEmailConfigured(),
      envVars: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
      rotateUrl: 'https://resend.com/api-keys',
    },
    {
      key: 'gemini', label: 'Gemini (IA)', kind: 'apikey',
      configured: !!process.env.GEMINI_API_KEY,
      envVars: ['GEMINI_API_KEY'],
      rotateUrl: 'https://aistudio.google.com/apikey',
    },
    {
      key: 'turnstile', label: 'Cloudflare Turnstile (captcha)', kind: 'apikey',
      // Le secret de vérification n'est pas dans nos env vars : il est
      // configuré côté Supabase Auth (Settings → Auth → Captcha protection),
      // qui vérifie le captchaToken transmis à signInWithOtp. Seule la site
      // key publique vit dans notre propre config.
      configured: !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      envVars: ['NEXT_PUBLIC_TURNSTILE_SITE_KEY'],
      rotateUrl: 'https://dash.cloudflare.com/?to=/:account/turnstile',
    },
    {
      key: 'supabase', label: 'Supabase', kind: 'apikey',
      configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      envVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      rotateUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    },
    {
      key: 'automation', label: 'Automatisation (Vercel Cron)', kind: 'apikey',
      configured: !!process.env.CRON_SECRET,
      envVars: ['CRON_SECRET'],
      rotateUrl: 'https://vercel.com',
    },
  ];

  return NextResponse.json({ entries });
}
