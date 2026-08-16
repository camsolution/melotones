import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
  try {
    // Aucun try/catch ici avant : un aller-retour réseau vers Supabase Auth
    // qui échoue ou traîne (réseau mobile, iCloud Private Relay — plus
    // fréquent sur Safari iOS que desktop) faisait planter TOUT le middleware
    // sans être rattrapé. Comme ce middleware tourne sur quasi toutes les
    // routes, ça affichait "This page couldn't load. A server error
    // occurred." sur n'importe quelle page, pas seulement les pages
    // protégées — correspond exactement au symptôme observé le 2026-08-16.
    // Filet de 5s : mieux vaut continuer sans session rafraîchie (le client
    // referra la vérification) que de bloquer toute la page.
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('updateSession timeout')), 5_000)),
    ]);
  } catch (err) {
    console.error('updateSession: getUser failed, continuing without refreshed session', err);
  }
  return response;
}
