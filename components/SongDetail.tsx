'use client';
import { Generation } from '@/types';
import { Download, Share2, MessageCircle, Copy, Check, RefreshCw, Globe2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import CoverStudio from '@/components/CoverStudio';
import TestimonialPrompt from '@/components/TestimonialPrompt';

export default function SongDetail({ song: initialSong, isOwner = false }: { song: Generation; isOwner?: boolean }) {
  const { t } = useLanguage();
  const [song, setSong] = useState<Generation>(initialSong);
  const [copied, setCopied] = useState(false);
  const [pollGaveUp, setPollGaveUp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingPublic, setUpdatingPublic] = useState(false);
  const pollCount = useRef(0);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `${t('Écoutez ma chanson générée par IA sur Melotones !', 'Listen to my AI-generated song on Melotones!')} ${song.occasion} · ${song.style}`;

  const fetchLatest = async () => {
    const res = await fetch(`/api/generations/${song.id}`);
    if (res.ok) {
      const updated = await res.json();
      setSong(updated);
      return updated;
    }
    return null;
  };

  useEffect(() => {
    if (song.status === 'completed' || song.status === 'failed') return;
    setPollGaveUp(false);

    const interval = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > 40) {
        clearInterval(interval);
        setPollGaveUp(true);
        return;
      }
      const updated = await fetchLatest();
      if (updated?.status === 'completed' || updated?.status === 'failed') {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [song.id, song.status]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchLatest();
    setRefreshing(false);
  };

  const togglePublic = async () => {
    setUpdatingPublic(true);
    try {
      const res = await fetch(`/api/generations/${song.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: !song.is_public }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSong(updated);
      }
    } finally {
      setUpdatingPublic(false);
    }
  };

  return (
    <div className="card max-w-2xl mx-auto text-center">
      {song.cover_url && (
        <img src={song.cover_url} alt="" className="w-48 h-48 mx-auto rounded-2xl object-cover shadow-lg mb-5" />
      )}
      <h1 className="text-3xl font-bold mb-2 text-gray-800">{t('Votre chanson est prête !', 'Your song is ready!')}</h1>
      <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-600 mb-6">
        <span className="bg-brand-100 text-brand-800 px-3 py-1 rounded-full capitalize">{song.occasion}</span>
        <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full">{song.style}</span>
      </div>
      <p className="text-gray-600 italic mb-6">« {song.custom_message} »</p>

      {song.status === 'completed' && song.audio_url ? (
        <>
          <audio controls preload="metadata" src={song.audio_url} className="w-full mb-6 rounded-lg" />
          <div className="flex flex-wrap justify-center gap-3">
            <a href={song.audio_url} download className="btn-primary flex items-center gap-2"><Download className="w-4 h-4" /> {t('Télécharger MP3', 'Download MP3')}</a>
            <button onClick={() => { if (navigator.share) navigator.share({ title: 'Melotones', text: shareText, url: shareUrl }); else { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } }} className="btn-secondary flex items-center gap-2"><Share2 className="w-4 h-4" /> {t('Partager', 'Share')}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2 !bg-green-50 !text-green-700 !border-green-200 hover:!bg-green-100"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
            <button onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn-secondary flex items-center gap-2">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? t('Copié', 'Copied') : t('Copier le lien', 'Copy link')}
            </button>
          </div>

          {isOwner && (
            <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-center gap-3">
              <Globe2 className="w-4 h-4 text-gray-400 flex-none" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-700">{t('Visible dans Explorer', 'Visible in Explore')}</p>
                <p className="text-xs text-gray-400">{t('Le message personnel reste privé — seuls l\'ambiance et le style sont montrés.', 'Your personal message stays private — only the vibe and style are shown.')}</p>
              </div>
              <button
                onClick={togglePublic}
                disabled={updatingPublic}
                role="switch"
                aria-checked={song.is_public}
                className={`relative w-11 h-6 rounded-full flex-none transition-colors ${song.is_public ? 'bg-brand-600' : 'bg-gray-300'} disabled:opacity-50`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${song.is_public ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}

          {isOwner && (
            <CoverStudio
              generationId={song.id}
              occasion={song.occasion}
              style={song.style}
              initialCoverUrl={song.cover_url ?? null}
              onSaved={(coverUrl) => setSong((s) => ({ ...s, cover_url: coverUrl }))}
            />
          )}

          {isOwner && <TestimonialPrompt generationId={song.id} />}
        </>
      ) : song.status === 'failed' ? (
        <p className="text-red-500">{song.localized_error || t('La génération a échoué. Veuillez réessayer.', 'Generation failed. Please try again.')}</p>
      ) : (
        <div className="flex flex-col items-center py-10">
          <svg className="animate-spin h-12 w-12 text-brand-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-lg font-medium text-gray-700">{t('Génération en cours…', 'Generating…')}</p>
          <p className="text-gray-500 mt-1">{t('Cela peut prendre 30 à 90 secondes selon le style.', 'This may take 30 to 90 seconds depending on the style.')}</p>
          {pollGaveUp && (
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-2">{t('Ça prend plus de temps que prévu.', 'Taking longer than expected.')}</p>
              <button onClick={handleManualRefresh} disabled={refreshing} className="btn-secondary flex items-center gap-2 mx-auto">
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? t('Vérification…', 'Checking…') : t('Vérifier maintenant', 'Check now')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
