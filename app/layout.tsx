import './globals.css';
import { Manrope, Unbounded } from 'next/font/google';
import AppShell from '@/components/AppShell';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import type { Session } from '@supabase/supabase-js';
import type { Metadata, Viewport } from 'next';

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope' });
const unbounded = Unbounded({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-unbounded' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.co';
const TITLE = 'Melotones — Chansons personnalisées composées par IA';
const DESCRIPTION = "Melotones compose pour vous une chanson sur mesure en quelques minutes, dans un style africain ou international, pour un anniversaire, un mariage ou toute occasion qui compte.";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s — Melotones' },
  description: DESCRIPTION,
  keywords: ['chanson personnalisée', 'musique IA', 'cadeau musical', 'chanson anniversaire', 'chanson mariage', 'génération musicale intelligence artificielle', 'Afrique', 'Sénégal'],
  applicationName: 'Melotones',
  authors: [{ name: 'Melotones' }],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  verification: { google: ['LJk1Byi94h5LKpxPJ9H8xsBvlMnneU5emoa_D8bkK0U', 'mnllNehUvuv3eOHmKjEdl0XjAAhg1c80GYqzUJPZq_I'] },
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
      sameAs: [
        'https://www.tiktok.com/@melotones',
        'https://www.instagram.com/melotones913/',
        'https://web.facebook.com/profile.php?id=61593188100817',
        'https://www.youtube.com/channel/UCCWzKz5_iUpDhUYtQ4PmFSg',
      ],
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
  const supabase = await createServerClientWithCookies();
  // Même filet que lib/supabase/middleware.ts : ce layout englobe TOUTE page
  // de l'app, donc un aller-retour réseau vers Supabase Auth qui traîne
  // (réseau mobile, iCloud Private Relay — plus fréquent sur Safari iOS)
  // plantait "This page couldn't load. A server error occurred." sur
  // n'importe quelle page. Le fix du middleware seul ne couvrait pas cet
  // appel identique et non protégé ici — mieux vaut rendre la page comme si
  // l'utilisateur n'était pas connecté (AppShell referra la vérification
  // côté client) que de bloquer le rendu entier.
  let session: Session | null = null;
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 5_000)),
    ]);
    session = result.data.session;
  } catch (err) {
    console.error('RootLayout: getSession failed, rendering without session', err);
  }
  return (
    <html lang="fr" className={`${manrope.variable} ${unbounded.variable}`}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#150E29" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="icon" href="/icon.png" />

        <LanguageProvider>
          <AppShell session={session}>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
