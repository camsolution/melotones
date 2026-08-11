import './globals.css';
import { Manrope, Unbounded } from 'next/font/google';
import AppShell from '@/components/AppShell';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createServerClientWithCookies } from '@/lib/supabase/server';

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope' });
const unbounded = Unbounded({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-unbounded' });

export const metadata = {
  title: 'Melotones - Créez des chansons uniques avec l’IA',
  description: 'Générez des morceaux personnalisés pour chaque occasion',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  return (
    <html lang="fr" className={`${manrope.variable} ${unbounded.variable}`}>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <LanguageProvider>
          <AppShell session={session}>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
