import { createServerClientWithCookies } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function requireAdmin() {
  const supabase = await createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' as const, status: 401, user: null };

  const { data: credit } = await supabaseAdmin
    .from('user_credits')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!credit?.is_admin) return { error: 'Forbidden' as const, status: 403, user: null };
  return { error: null, status: 200, user };
}

// PostgREST ne reconnaît pas de relation vers auth.users (schéma non exposé),
// donc les jointures .select('*, user:user_id(email)') échouent silencieusement.
// On récupère les emails via l'API Admin, par lots de requêtes en parallèle.
export async function getEmailsByIds(ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids));
  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      return [id, data.user?.email || id] as const;
    })
  );
  return new Map(results);
}

// Autorise les routines cloud (agents d'automatisation) à appeler certains
// endpoints admin étroits via un secret dédié — jamais SUPABASE_SERVICE_ROLE_KEY,
// pour limiter le blast radius si le secret fuit (même principe que BACKUP_EXPORT_SECRET).
export function verifyAutomationSecret(request: Request): boolean {
  const expected = process.env.AUTOMATION_SECRET;
  if (!expected) return false;
  const url = new URL(request.url);
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export { supabaseAdmin };
