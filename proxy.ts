import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';

const CANONICAL_HOST = 'melotones.co';

// Pages entièrement publiques, sans aucune dépendance à la session utilisateur
// (ni lecture, ni redirection conditionnelle) — inutile d'y payer l'aller-retour
// réseau vers Supabase Auth pour rafraîchir un cookie de session que la page
// n'utilise jamais. /login et /signup en sont exclus car AuthForm s'appuie sur
// un cookie de session à jour pour rediriger un utilisateur déjà connecté.
const PUBLIC_NO_SESSION_PATHS = new Set(['/', '/terms', '/privacy']);

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || '';
  // Redirige tout hostname non canonique (anciens alias Vercel, domaine
  // supprimé, etc.) vers melotones.co en conservant le chemin et les
  // paramètres — notamment le ?code= du retour OAuth Google, qui doit
  // impérativement arriver sur le domaine que Supabase attend.
  if (host && host !== CANONICAL_HOST && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const url = new URL(request.url);
    url.host = CANONICAL_HOST;
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  if (PUBLIC_NO_SESSION_PATHS.has(new URL(request.url).pathname)) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
