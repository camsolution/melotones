'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { Generation } from '@/types';

export default function HistoryPage() {
  const { t } = useLanguage();
  const [songs, setSongs] = useState<Generation[]>([]);
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
      supabase.from('generations').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        .then(({ data }) => setSongs(data || []));
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">{t('Ma bibliothèque', 'My Library')}</h1>
      {songs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">{t('Vous n’avez pas encore créé de chanson.', 'You haven’t created a song yet.')}</p>
          <Link href="/create" className="btn-primary">{t('Créer ma première chanson', 'Create my first song')}</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {songs.map((song) => (
            <div key={song.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><Clock className="w-4 h-4" />{new Date(song.created_at).toLocaleDateString('fr-FR')}</div>
                <h3 className="text-xl font-semibold capitalize text-gray-800">{song.occasion} · {song.style}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${song.status === 'completed' ? 'bg-green-100 text-green-800' : song.status === 'processing' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                  {song.status === 'completed' ? t('Terminé', 'Completed') : song.status === 'processing' ? t('En cours', 'Processing') : t('Échoué', 'Failed')}
                </span>
              </div>
              <Link href={`/songs/${song.id}`} className="btn-secondary flex items-center gap-2 self-end sm:self-center">{t('Écouter', 'Listen')} <ArrowRight className="w-4 h-4" /></Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
