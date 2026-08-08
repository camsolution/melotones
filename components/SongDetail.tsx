'use client';
import { Generation } from '@/types';
import { Download, Share2, MessageCircle, Copy, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SongDetail({ song: initialSong }: { song: Generation }) {
  const { t } = useLanguage();
  const [song, setSong] = useState<Generation>(initialSong);
  const [copied, setCopied] = useState(false);
  const pollCount = useRef(0);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `${t('Écoutez ma chanson générée par IA sur Melotones !', 'Listen to my AI-generated song on Melotones!')} ${song.occasion} · ${song.style}`;

  useEffect(() => {
    if (song.status === 'completed' || song.status === 'failed') return;

    const interval = setInterval(async () => {
      pollCount.current += 1;
      // Arrêt de sécurité après ~2 minutes (24 x 5s) pour éviter un polling infini
      if (pollCount.current > 24) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`/api/generations/${song.id}`);
        if (res.ok) {
          const updated = await res.json();
          setSong(updated);
          if (updated.status === 'completed' || updated.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Erreur de polling:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [song.id, song.status]);

  return (
    <div className="card max-w-2xl mx-auto text-center">
      <h1 className="text-3xl font-bold mb-2 text-gray-800">{t('Votre chanson est prête !', 'Your song is ready!')}</h1>
      <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-600 mb-6">
        <span className="bg-brand-100 text-brand-800 px-3 py-1 rounded-full capitalize">{song.occasion}</span>
        <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full">{song.style}</span>
      </div>
      <p className="text-gray-600 italic mb-6">« {song.custom_message} »</p>

      {song.status === 'completed' && song.audio_url ? (
        <>
          <audio controls src={song.audio_url} className="w-full mb-6 rounded-lg" />
          <div className="flex flex-wrap justify-center gap-3">
            <a href={song.audio_url} download className="btn-primary flex items-center gap-2"><Download className="w-4 h-4" /> {t('Télécharger MP3', 'Download MP3')}</a>
            <button onClick={() => { if (navigator.share) navigator.share({ title: 'Melotones', text: shareText, url: shareUrl }); else { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } }} className="btn-secondary flex items-center gap-2"><Share2 className="w-4 h-4" /> {t('Partager', 'Share')}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2 !bg-green-50 !text-green-700 !border-green-200 hover:!bg-green-100"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
            <button onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn-secondary flex items-center gap-2">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? t('Copié', 'Copied') : t('Copier le lien', 'Copy link')}
            </button>
          </div>
        </>
      ) : song.status === 'failed' ? (
        <p className="text-red-500">{t('La génération a échoué. Veuillez réessayer.', 'Generation failed. Please try again.')}</p>
      ) : (
        <div className="flex flex-col items-center py-10">
          <svg className="animate-spin h-12 w-12 text-brand-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-lg font-medium text-gray-700">{t('Génération en cours…', 'Generating…')}</p>
          <p className="text-gray-500 mt-1">{t('Cela peut prendre 30 à 60 secondes.', 'This may take 30 to 60 seconds.')}</p>
        </div>
      )}
    </div>
  );
}
