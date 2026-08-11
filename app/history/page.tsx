'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, ArrowRight, Sparkles, Disc3 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { Generation } from '@/types';

const STATUS_STYLES: Record<Generation['status'], string> = {
  completed: 'bg-green-100 text-green-800',
  processing: 'bg-yellow-100 text-yellow-800',
  queued: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-800',
};

export default function HistoryPage() {
  const { lang, t } = useLanguage();
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
    <div className="max-w-4xl mx-auto px-5 md:px-10 py-8 md:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl text-gray-800">{t('Ma Musique', 'My Music')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('Toutes tes créations, au même endroit.', 'All your creations, in one place.')}</p>
        </div>
        <Link href="/create" className="hidden sm:inline-flex items-center gap-2 font-bold text-[13.5px] px-5 py-2.5 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500">
          <Sparkles className="w-4 h-4" /> {t('Nouvelle chanson', 'New song')}
        </Link>
      </div>

      {songs.length === 0 ? (
        <div className="rounded-[28px] border border-gray-200 bg-white shadow-xl p-10 flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-full relative" style={{
            background: 'repeating-radial-gradient(circle at center, #2A1B4B 0 3px, #1B1130 3px 6px)',
            boxShadow: 'inset 0 0 0 1px #E4D9F5',
          }}>
            <div className="absolute inset-0 m-auto w-[28px] h-[28px] rounded-full bg-gradient-to-br from-magenta-500 to-amber-400" />
            <div className="absolute left-1/2 top-1/2 w-[28px] h-[28px] -ml-[14px] -mt-[14px] rounded-full border-[7px] border-white box-border" />
          </div>
          <p className="text-gray-500 max-w-sm">{t('Vous n’avez pas encore créé de chanson.', 'You haven’t created a song yet.')}</p>
          <Link href="/create" className="inline-flex items-center gap-2 font-bold text-[13.5px] px-6 py-3 rounded-full text-white bg-gradient-to-r from-brand-600 to-magenta-500">
            <Sparkles className="w-4 h-4" /> {t('Créer ma première chanson', 'Create my first song')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {songs.map((song) => (
            <div key={song.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-xl flex-none flex items-center justify-center text-white bg-gradient-to-br from-brand-500 to-magenta-500">
                  <Disc3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><Clock className="w-4 h-4" />{new Date(song.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</div>
                  <h3 className="text-lg font-semibold capitalize text-gray-800 truncate">{song.occasion} · {song.style}</h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[song.status]}`}>
                    {song.status === 'completed' ? t('Terminé', 'Completed') : song.status === 'processing' ? t('En cours', 'Processing') : song.status === 'queued' ? t('En attente', 'Queued') : t('Échoué', 'Failed')}
                  </span>
                </div>
              </div>
              <Link href={`/songs/${song.id}`} className="btn-secondary flex items-center gap-2 self-end sm:self-center flex-none">{t('Écouter', 'Listen')} <ArrowRight className="w-4 h-4" /></Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
