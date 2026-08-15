/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Empêche d'intégrer le site dans une <iframe> tierce (clickjacking).
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Empêche le navigateur de deviner un type MIME différent de celui déclaré.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // N'envoie l'URL complète en Referer qu'en navigation same-origin.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Désactive les API navigateur sensibles que l'app n'utilise pas.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Surface externe réelle : Turnstile (script + iframe de challenge)
          // et Supabase (auth/storage/postgrest appelés depuis le client).
          // img-src reste large (https:) car les vignettes Canva viennent
          // d'une CDN à domaine variable — le risque XSS d'une balise <img>
          // est très inférieur à celui d'un script, donc ce compromis est
          // volontaire plutôt qu'un oubli. script-src garde 'unsafe-inline'
          // car Next.js App Router injecte du JSON/scripts inline au
          // hydratage ; passer à une CSP par nonce est un chantier séparé,
          // plus risqué à valider sans environnement de staging.
          // media-src + blob: (img-src/connect-src) sont nécessaires pour
          // CoverStudio.tsx (aperçu GIF affiché en <img src="blob:...">,
          // fetch("blob:...") pour l'enregistrer) et pour le lecteur audio
          // vedette (fichier servi depuis Supabase Storage, jamais 'self' —
          // sans media-src explicite le navigateur retombe sur default-src
          // 'self' et bloque la lecture).
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https: data: blob:",
              "font-src 'self' data:",
              "media-src 'self' https://*.supabase.co blob:",
              "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com blob:",
              "frame-src https://challenges.cloudflare.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
