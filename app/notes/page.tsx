'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Music2 } from 'lucide-react';
import CreditsManager from '@/components/CreditsManager';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';

export default function NotesPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login');
      else setUser(user);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_credits').select('balance').eq('user_id', user.id).single()
      .then(({ data }) => setBalance(data?.balance ?? 0));
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl flex-none flex items-center justify-center text-white bg-gradient-to-br from-magenta-500 to-amber-400">
          <Music2 className="w-5 h-5" strokeWidth={1.9} />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-gray-800">{t('Notes', 'Notes')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('1 Note = 1 chanson générée.', '1 Note = 1 generated song.')}</p>
        </div>
      </div>

      <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-8 my-6 flex items-baseline gap-2">
        <span className="font-display font-extrabold text-5xl text-gray-800 tabular-nums">{balance}</span>
        <span className="text-gray-500 font-semibold">{t('Note(s) disponible(s)', 'Note(s) available')}</span>
      </div>

      <h2 className="font-display font-bold text-[15px] text-gray-800 mb-4">{t('Acheter des Notes', 'Buy Notes')}</h2>
      <CreditsManager />
    </div>
  );
}
