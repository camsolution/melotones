import './globals.css';
import Navbar from '@/components/Navbar';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createServerClientWithCookies } from '@/lib/supabase/server';

export const metadata = {
  title: 'Melotones - Créez des chansons uniques avec l’IA',
  description: 'Générez des morceaux personnalisés pour chaque occasion',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <LanguageProvider>
          <Navbar session={session} />
          <main className="container mx-auto px-4 py-8 min-h-screen">
            {children}
          </main>
          <footer className="text-center text-sm text-gray-400 py-6 border-t border-gray-200">
            © 2025 Melotones. Fait avec ❤️ pour la musique.
          </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}
