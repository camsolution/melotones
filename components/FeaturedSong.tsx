'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Radio } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';
import { styleMeta } from '@/lib/styleMeta';

type Featured = {
  id: string;
  occasion: string;
  style: string;
  audio_url: string;
  cover_url: string | null;
};

const BAR_COUNT = 28;

export default function FeaturedSong() {
  const { lang, t } = useLanguage();
  const [song, setSong] = useState<Featured | null>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  const [showHint, setShowHint] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetch('/api/featured-song')
      .then((r) => r.json())
      .then((s) => setSong(s))
      .catch(() => {});
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const gap = 3;
    const barWidth = (width - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    const step = Math.floor(data.length / BAR_COUNT);

    for (let i = 0; i < BAR_COUNT; i++) {
      const v = data[i * step] / 255;
      const barHeight = Math.max(3, v * height);
      const x = i * (barWidth + gap);
      const y = height - barHeight;
      const grad = ctx.createLinearGradient(0, height, 0, 0);
      grad.addColorStop(0, '#8B5CF6');
      grad.addColorStop(0.55, '#F23D82');
      grad.addColorStop(1, '#FFB23E');
      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = Math.min(3, barWidth / 2);
      ctx.roundRect(x, y, barWidth, barHeight, r);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (!song || !ready || !audioRef.current) return;
    const audio = audioRef.current;

    let ctx: AudioContext | null = null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const gain = ctx.createGain();
      gain.gain.value = 0; // démarre coupé — la lecture auto avec son est bloquée par les navigateurs de toute façon
      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);
      analyserRef.current = analyser;
      gainRef.current = gain;
      rafRef.current = requestAnimationFrame(draw);
    } catch {
      // Web Audio indisponible : on se contente du lecteur muet en boucle, sans visualiseur
    }

    audio.muted = true;
    audio.play().catch(() => {});

    // Le son audible ne peut jamais démarrer tout seul (règle imposée par tous les
    // navigateurs) — on attire l'œil sur le bouton pendant quelques secondes pour
    // que l'activation au clic soit aussi immédiate que possible pour l'utilisateur.
    setShowHint(true);
    const hintTimer = setTimeout(() => setShowHint(false), 6000);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ctx?.close().catch(() => {});
      audioCtxRef.current = null;
      clearTimeout(hintTimer);
    };
  }, [song, ready, draw]);

  const toggleMute = () => {
    setShowHint(false);
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    if (gainRef.current && audioRef.current) {
      gainRef.current.gain.setTargetAtTime(next ? 0 : 1, audioRef.current.currentTime || 0, 0.05);
    }
    // Le navigateur suspend l'AudioContext tant qu'aucun geste utilisateur direct
    // ne le relance — sans ce reprise explicite, aucun son ne sort même une fois
    // démuté. Le clic sur le haut-parleur EST ce geste, donc on en profite ici.
    if (!next) audioCtxRef.current?.resume().catch(() => {});
    audioRef.current?.play().catch(() => {});
  };

  if (!song) return null;

  const occasionLabel = occasionTranslations[song.occasion]?.[lang] ?? song.occasion;
  const styleLabel = styleTranslations[song.style]?.[lang] ?? song.style;

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-stage via-[#1F1640] to-[#291D52] border border-stage-border px-5 py-4 flex items-center gap-4">
      <audio
        ref={audioRef}
        src={song.audio_url}
        loop
        playsInline
        crossOrigin="anonymous"
        onCanPlay={() => setReady(true)}
        className="hidden"
      />

      {song.cover_url ? (
        <img src={song.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-none shadow-md" />
      ) : (
        <div className="w-12 h-12 rounded-xl flex-none bg-gradient-to-br from-violet-500 via-magenta-500 to-amber-400 flex items-center justify-center text-xl">
          {styleMeta[song.style]?.emoji ?? '🎵'}
        </div>
      )}

      <div className="min-w-0 flex-none w-32 sm:w-40">
        <span className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-violet-300 mb-0.5">
          <Radio className="w-3 h-3" /> {t('En vedette', 'Featured')}
        </span>
        <p className="font-display font-bold text-white text-[13.5px] truncate capitalize">{occasionLabel}</p>
        <p className="text-[11.5px] text-violet-200/70 truncate">{styleLabel}</p>
      </div>

      <canvas ref={canvasRef} width={320} height={44} className="flex-1 min-w-0 h-11" aria-hidden />

      <div className="relative flex-none">
        {showHint && muted && (
          <span className="absolute -top-9 right-0 whitespace-nowrap bg-white text-stage text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-lg animate-bounce">
            {t('🔊 Activer le son', '🔊 Unmute')}
          </span>
        )}
        {showHint && muted && (
          <span className="absolute inset-0 rounded-full bg-magenta-500/60 animate-ping" aria-hidden />
        )}
        <button
          onClick={toggleMute}
          className="relative w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors"
          title={muted ? t('Activer le son', 'Unmute') : t('Couper le son', 'Mute')}
          aria-label={muted ? t('Activer le son', 'Unmute') : t('Couper le son', 'Mute')}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </section>
  );
}
