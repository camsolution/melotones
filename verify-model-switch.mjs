import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('/home/ns1/melotones/.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = 'https://melotones.co';
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const email = `verify-model-${Date.now()}@melotones-test.local`;
  const { data: userRes } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const userId = userRes.user.id;
  try {
    await admin.from('user_credits').upsert({ user_id: userId, balance: 0, is_admin: true }, { onConflict: 'user_id' });
    const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    let cookieJar = {};
    const cookieClient = createServerClient(SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => Object.entries(cookieJar).map(([name, value]) => ({ name, value })),
        setAll: (cookies) => { for (const c of cookies) cookieJar[c.name] = c.value; },
      },
    });
    await cookieClient.auth.verifyOtp({ email, token: linkData.properties.email_otp, type: 'magiclink' });
    const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');

    const res = await fetch(`${SITE}/api/admin/canva/generate-prompt`, {
      method: 'POST', headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      body: JSON.stringify({ angle: 'mariage' }),
    });
    const body = await res.json();
    console.log('status:', res.status);
    console.log(body.prompt || body);
  } finally {
    await admin.from('user_credits').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
