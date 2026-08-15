'use client';
import { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
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
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  // Refs plutôt que document.getElementById : plus fiable sur les navigateurs
  // mobiles, où le geste tactile doit rester attaché sans détour par une
  // recherche DOM.
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  if (!songs.length) return null;

  // Safari iOS "débloque" chaque <audio> individuellement, et seulement si
  // .play() est appelé de façon strictement synchrone dans le geste tactile
  // — le moindre await/.then() avant l'appel casse ce lien. preload="none"
  // (pas "metadata") pour éviter tout chargement autonome qui pourrait
  // perturber cet état avant même le tap. C'est pourquoi .play() est la
  // toute première ligne ici, avant même de mettre en pause l'autre piste.
  const toggle = (song: ExampleSong) => {
    const audio = audioRefs.current.get(song.id);
    if (!audio) return;

    if (playingId === song.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    const playPromise = audio.play();
    if (playingId) audioRefs.current.get(playingId)?.pause();
    playPromise
      .then(() => { setErrorId(null); setPlayingId(song.id); })
      .catch(() => setErrorId(song.id));
  };

  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800">{t('Créations de la communauté', 'Community Creations')}</h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">{t('Écoutez des morceaux uniques créés par nos utilisateurs pour leurs proches.', 'Listen to unique songs created by our users for their loved ones.')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {songs.map((song) => (
          <div key={song.id} className="card overflow-hidden">
            {/* Pas de group/group-hover ici : sur Safari iOS et certains
                Android, quand le style de survol dépend d'un ANCÊTRE plutôt
                que de l'élément tapé lui-même, le premier tap ne fait que
                simuler le survol au lieu de déclencher le clic — il en faut
                un second. hover: direct + active: (retour tactile immédiat)
                évite complètement cette ambiguïté. */}
            <div className={`relative h-40 bg-gradient-to-br ${occasionColors[song.occasion] || 'from-brand-300 to-pink-300'} flex items-center justify-center`}>
              <div className="absolute inset-0 bg-black/10 transition-colors" />
              <button
                aria-label={playingId === song.id ? t('Mettre en pause', 'Pause') : t('Écouter', 'Play')}
                onClick={() => toggle(song)}
                className="relative z-10 w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                {playingId === song.id
                  ? <Pause className="w-6 h-6 text-brand-700 fill-brand-700" />
                  : <Play className="w-6 h-6 text-brand-700 fill-brand-700 ml-0.5" />}
              </button>
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-lg text-gray-800">{song.title}</h3>
              <p className="text-sm text-gray-500 capitalize">{song.occasion} · {song.style}</p>
              {errorId === song.id && (
                <p className="text-xs text-red-500 mt-1">{t('Lecture impossible sur cet appareil — réessaie.', "Playback failed on this device — try again.")}</p>
              )}
              <audio
                ref={(el) => { if (el) audioRefs.current.set(song.id, el); else audioRefs.current.delete(song.id); }}
                src={song.audio_url} preload="none" playsInline className="hidden"
                onEnded={() => setPlayingId((p) => (p === song.id ? null : p))}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
