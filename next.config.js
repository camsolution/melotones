/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit charge ses polices standard depuis des fichiers .afm au runtime —
  // le traçage de fichiers de Next.js ne les inclut pas automatiquement dans
  // le bundle serverless, il faut les lister explicitement (constaté en prod).
  outputFileTracingIncludes: {
    '/api/admin/partners/[id]/report': ['./node_modules/pdfkit/js/data/**'],
  },
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
