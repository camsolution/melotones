'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CreditsManager from '@/components/CreditsManager';
import { CreditCard, Music } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const { t } = useLanguage();
  const [credits, setCredits] = useState<number>(0);
  const [totalGenerations, setTotalGenerations] = useState<number>(0);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login');
      else setUser(user);
    });
  }, []);

  useEffect(() => {
    if (user) {
      supabase.from('user_credits').select('balance').eq('user_id', user.id).single()
        .then(({ data }) => setCredits(data?.balance ?? 0));
      supabase.from('generations').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
        .then(({ count }) => setTotalGenerations(count ?? 0));
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">{t('Tableau de bord', 'Dashboard')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="card">
          <div className="flex items-center gap-3 mb-4"><div className="bg-brand-100 p-3 rounded-full"><CreditCard className="w-6 h-6 text-brand-600" /></div><h2 className="text-xl font-semibold text-gray-800">{t('Crédits', 'Credits')}</h2></div>
          <p className="text-4xl font-bold text-brand-700 mb-4">{credits}</p>
          <CreditsManager />
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-4"><div className="bg-pink-100 p-3 rounded-full"><Music className="w-6 h-6 text-pink-600" /></div><h2 className="text-xl font-semibold text-gray-800">{t('Statistiques', 'Statistics')}</h2></div>
          <p className="text-4xl font-bold text-pink-700">{totalGenerations}</p>
          <p className="text-gray-500">{t('chansons générées', 'songs generated')}</p>
        </div>
      </div>
    </div>
  );
}
