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
        ],
      },
    ];
  },
};
module.exports = nextConfig;
