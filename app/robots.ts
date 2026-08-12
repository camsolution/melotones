import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.co';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/explore', '/privacy', '/terms', '/login', '/signup', '/songs/', '/guide'],
      disallow: ['/api/', '/dashboard', '/create', '/profil', '/statistiques', '/notes', '/history', '/shorts', '/admin', '/auth/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
