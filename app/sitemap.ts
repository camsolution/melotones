import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/admin';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.co';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/explore`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/signup`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const { data: songs } = await supabaseAdmin
    .from('generations')
    .select('id, created_at')
    .eq('is_public', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1000);

  const songRoutes: MetadataRoute.Sitemap = (songs || []).map((s) => ({
    url: `${SITE_URL}/songs/${s.id}`,
    lastModified: s.created_at,
    changeFrequency: 'monthly',
    priority: 0.4,
  }));

  return [...staticRoutes, ...songRoutes];
}
