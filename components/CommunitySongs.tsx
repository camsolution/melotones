'use client';
import { Play } from 'lucide-react';
import { ExampleSong } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

const occasionColors: Record<string, string> = {
  birthday: 'from-yellow-300 to-orange-400',
  wedding: 'from-pink-300 to-rose-400',
  baptism: 'from-blue-300 to-cyan-400',
  graduation: 'from-green-300 to-emerald-400',
  tribute: 'from-purple-300 to-indigo-400',
  dowry: 'from-red-300 to-pink-400',
  proposal: 'from-rose-300 to-pink-400',
  encouragement: 'from-teal-300 to-green-400',
  apology: 'from-gray-300 to-blue-400',
  fun: 'from-fuchsia-300 to-purple-400',
};

export default function CommunitySongs({ songs }: { songs: ExampleSong[] }) {
  const { t } = useLanguage();
  if (!songs.length) return null;
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800">{t('Créations de la communauté', 'Community Creations')}</h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">{t('Écoutez des morceaux uniques créés par nos utilisateurs pour leurs proches.', 'Listen to unique songs created by our users for their loved ones.')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {songs.map((song) => (
          <div key={song.id} className="card group overflow-hidden">
            <div className={`relative h-40 bg-gradient-to-br ${occasionColors[song.occasion] || 'from-brand-300 to-pink-300'} flex items-center justify-center`}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
              <button onClick={() => {
                const audio = document.getElementById(`audio-${song.id}`) as HTMLAudioElement;
                if (audio) audio.paused ? audio.play() : audio.pause();
              }} className="relative z-10 w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-brand-700 fill-brand-700 ml-0.5" />
              </button>
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-lg text-gray-800">{song.title}</h3>
              <p className="text-sm text-gray-500 capitalize">{song.occasion} · {song.style}</p>
              <audio id={`audio-${song.id}`} src={song.audio_url} className="hidden" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
