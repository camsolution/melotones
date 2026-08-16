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
      {/* Grille de tuiles carrées façon streaming plutôt que de grosses cartes
          3-par-ligne — pensée pour tenir visuellement à des centaines/milliers
          de titres, pas seulement la poignée actuelle. La taille de la tuile
          est celle du format de cover (carré), pas une carte qui l'encadre. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
        {songs.map((song) => (
          <div key={song.id}>
            {/* Pas de group/group-hover sur le bouton play lui-même : sur
                Safari iOS et certains Android, quand le style de survol
                dépend d'un ANCÊTRE plutôt que de l'élément tapé, le premier
                tap ne fait que simuler le survol au lieu de déclencher le
                clic — il en faut un second. hover: direct + active: (retour
                tactile immédiat) évite complètement cette ambiguïté. */}
            <div className={`relative aspect-square w-full rounded-xl overflow-hidden shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br ${occasionColors[song.occasion] || 'from-brand-300 to-pink-300'} flex items-center justify-center`}>
              {song.cover_url && (
                <img
                  decoding="async" loading="lazy"
                  src={song.cover_url} alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/5" />
              <button
                aria-label={playingId === song.id ? t('Mettre en pause', 'Pause') : t('Écouter', 'Play')}
                onClick={() => toggle(song)}
                className="relative z-10 w-11 h-11 sm:w-12 sm:h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                {playingId === song.id
                  ? <Pause className="w-5 h-5 text-brand-700 fill-brand-700" />
                  : <Play className="w-5 h-5 text-brand-700 fill-brand-700 ml-0.5" />}
              </button>
              <audio
                ref={(el) => { if (el) audioRefs.current.set(song.id, el); else audioRefs.current.delete(song.id); }}
                src={song.audio_url} preload="none" playsInline className="hidden"
                onEnded={() => setPlayingId((p) => (p === song.id ? null : p))}
              />
            </div>
            <div className="pt-2 px-0.5">
              <h3 className="font-semibold text-sm text-gray-800 truncate">{song.title}</h3>
              <p className="text-xs text-gray-500 capitalize truncate">{song.occasion} · {song.style}</p>
              {errorId === song.id && (
                <p className="text-[11px] text-red-500 mt-0.5">{t('Lecture impossible — réessaie.', "Playback failed — try again.")}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
