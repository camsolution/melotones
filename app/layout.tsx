import './globals.css';
import { Manrope, Unbounded } from 'next/font/google';
import AppShell from '@/components/AppShell';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import type { Metadata } from 'next';

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope' });
const unbounded = Unbounded({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-unbounded' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.co';
const TITLE = 'Melotones — Chansons personnalisées composées par IA';
const DESCRIPTION = "Melotones compose pour vous une chanson sur mesure en quelques minutes, dans un style africain ou international, pour un anniversaire, un mariage ou toute occasion qui compte.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s — Melotones' },
  description: DESCRIPTION,
  keywords: ['chanson personnalisée', 'musique IA', 'cadeau musical', 'chanson anniversaire', 'chanson mariage', 'génération musicale intelligence artificielle', 'Afrique', 'Sénégal'],
  applicationName: 'Melotones',
  authors: [{ name: 'Melotones' }],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    siteName: 'Melotones',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og-image.png', width: 512, height: 512, alt: 'Melotones' }],
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Melotones',
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
    },
    {
      '@type': 'WebSite',
      name: 'Melotones',
      url: SITE_URL,
      inLanguage: 'fr',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Melotones',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      description: DESCRIPTION,
      url: SITE_URL,
    },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  return (
    <html lang="fr" className={`${manrope.variable} ${unbounded.variable}`}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <LanguageProvider>
          <AppShell session={session}>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
