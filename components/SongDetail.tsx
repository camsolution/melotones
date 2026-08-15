'use client';
import { Generation } from '@/types';
import { Download, Share2, MessageCircle, Copy, Check, RefreshCw, Globe2, Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import CoverStudio from '@/components/CoverStudio';
import TestimonialPrompt from '@/components/TestimonialPrompt';
import { getOrCreateSessionId } from '@/components/PageViewTracker';
import { embedCoverArt } from '@/lib/audioTag';

// Messages courts et humains par occasion (section 3/10 — pas d'appel IA par
// partage, pour garder ça gratuit et instantané) plutôt que le texte
// générique "Écoutez ma chanson générée par IA" utilisé jusqu'ici. Plusieurs
// variantes par occasion, tirées au hasard à chaque chanson, pour que le
// message par défaut ne soit jamais deux fois identique.
const SHARE_TEMPLATES: Record<string, { emoji: string; fr: string; en: string }[]> = {
  birthday: [
    { emoji: '🎂', fr: "J'ai créé une chanson spécialement pour toi. J'espère qu'elle te fera sourire", en: 'I created a song just for you. I hope it makes you smile' },
    { emoji: '🎉', fr: "Pour ton anniversaire, voici un cadeau que personne d'autre ne pourra t'offrir", en: "For your birthday, here's a gift no one else could give you" },
    { emoji: '🥳', fr: "Une chanson rien que pour toi, pour ce jour qui n'appartient qu'à toi", en: "A song just for you, for this day that's all yours" },
  ],
  wedding: [
    { emoji: '💍', fr: 'Pour célébrer votre union, voici une chanson rien que pour vous', en: 'To celebrate your union, here is a song just for you' },
    { emoji: '💐', fr: 'Une chanson composée pour marquer le début de votre histoire', en: 'A song composed to mark the start of your story' },
    { emoji: '👰', fr: 'Que cette chanson accompagne le plus beau jour de votre vie', en: 'May this song accompany the most beautiful day of your life' },
  ],
  baptism: [
    { emoji: '🕊️', fr: 'Une chanson pour marquer ce moment si spécial', en: 'A song to mark this special moment' },
    { emoji: '👶', fr: 'Pour souhaiter la bienvenue à ce petit être, une chanson pleine de douceur', en: 'To welcome this little one, a song full of tenderness' },
    { emoji: '🙏', fr: 'Un souvenir musical pour ce jour béni', en: 'A musical keepsake for this blessed day' },
  ],
  graduation: [
    { emoji: '🎓', fr: 'Bravo pour cette réussite ! Voici une chanson rien que pour toi', en: "Congrats on this achievement! Here's a song just for you" },
    { emoji: '🏆', fr: 'Tous ces efforts méritaient bien une chanson à ta hauteur', en: 'All that hard work deserved a song as big as your achievement' },
    { emoji: '📚', fr: 'Une chanson pour célébrer ce que tu as accompli', en: "A song to celebrate what you've accomplished" },
  ],
  tribute: [
    { emoji: '🕯️', fr: "J'ai transformé ce que je ressens en musique, en hommage", en: 'I turned what I feel into music, as a tribute' },
    { emoji: '🤍', fr: "Un hommage en musique, pour que jamais on n'oublie", en: 'A musical tribute, so we never forget' },
    { emoji: '🕊️', fr: 'Certains souvenirs méritent d\'être chantés', en: 'Some memories deserve to be sung' },
  ],
  dowry: [
    { emoji: '💐', fr: 'Une chanson pour célébrer cette union', en: 'A song to celebrate this union' },
    { emoji: '🎊', fr: 'Pour marquer cette étape importante entre nos familles', en: 'To mark this important step between our families' },
  ],
  proposal: [
    { emoji: '💖', fr: 'Cette chanson est pour toi. Je voulais transformer ce que je ressens en musique', en: 'This song is for you. I wanted to turn what I feel into music' },
    { emoji: '💍', fr: "Avant de te poser LA question, j'ai voulu te dire ça en chanson", en: 'Before asking THE question, I wanted to tell you this in song' },
    { emoji: '❤️', fr: "Une chanson pour te dire ce que les mots seuls ne suffisent pas à exprimer", en: "A song to say what words alone can't express" },
  ],
  encouragement: [
    { emoji: '🔥', fr: "J'ai créé cette chanson pour te rappeler de ne jamais abandonner", en: 'I created this song to remind you to never give up' },
    { emoji: '💪', fr: "Monte le son et rappelle-toi de quoi tu es capable", en: 'Turn it up and remember what you\'re capable of' },
    { emoji: '✨', fr: 'Une chanson pour te donner la force de continuer', en: 'A song to give you the strength to keep going' },
  ],
  apology: [
    { emoji: '🙏', fr: 'Une chanson pour te dire, à ma façon, à quel point je suis désolé(e)', en: 'A song to say, in my own way, how sorry I am' },
    { emoji: '🤍', fr: "Les mots ne suffisaient pas, alors j'ai essayé en musique", en: "Words weren't enough, so I tried music instead" },
  ],
  fun: [
    { emoji: '🎁', fr: "J'ai une petite surprise pour toi. Écoute jusqu'au bout…", en: 'I have a little surprise for you. Listen till the end…' },
    { emoji: '😄', fr: "Je me suis un peu amusé(e) à créer ça pour toi", en: 'I had a little fun creating this for you' },
    { emoji: '🎶', fr: 'Petite chanson, grande intention', en: 'Small song, big intention' },
  ],
};

// Hash déterministe (pas Math.random) : ce composant se rend une première
// fois côté serveur puis s'hydrate côté client — un vrai tirage aléatoire
// donnerait deux résultats différents et déclencherait une erreur
// d'hydratation React. L'ID de la chanson est stable des deux côtés, donc le
// "hasard" est en réalité déterminé par la chanson (chacune a sa variante).
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildDefaultMessage(occasion: string, lang: 'fr' | 'en', seed: string): string {
  const variants = SHARE_TEMPLATES[occasion];
  if (!variants || variants.length === 0) return lang === 'fr' ? "J'ai créé une chanson rien que pour toi avec Melotones" : 'I created a song just for you with Melotones';
  const tpl = variants[hashString(seed) % variants.length];
  return `${tpl.emoji} ${tpl[lang]}`;
}

// navigator.clipboard.writeText() peut échouer silencieusement (contexte non
// sécurisé, permission refusée, vieux WebView Android) — le bug signalé
// ("ça ne donne rien") vient de ce que l'ancien code affichait "Copié" sans
// jamais vérifier si la promesse aboutissait. Repli sur execCommand('copy')
// pour les navigateurs qui refusent l'API moderne.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function SongDetail({ song: initialSong, isOwner = false }: { song: Generation; isOwner?: boolean }) {
  const { t, lang } = useLanguage();
  const [song, setSong] = useState<Generation>(initialSong);
  const [copied, setCopied] = useState(false);
  const [copyFallbackText, setCopyFallbackText] = useState<string | null>(null);
  const [pollGaveUp, setPollGaveUp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingPublic, setUpdatingPublic] = useState(false);
  const pollCount = useRef(0);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const defaultMessage = useMemo(() => buildDefaultMessage(song.occasion, lang === 'en' ? 'en' : 'fr', song.id), [song.occasion, lang, song.id]);
  const [shareMessage, setShareMessage] = useState(defaultMessage);
  useEffect(() => { setShareMessage(defaultMessage); }, [defaultMessage]);

  const trackShare = (channel: string) => {
    try {
      fetch('/api/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: getOrCreateSessionId(), path: `/share/${channel}` }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  const shareUrlFor = (channel: string) => `${baseUrl}?utm_source=${channel}&utm_medium=share&utm_campaign=song_share`;
  // Ligne d'accompagnement fixe (jamais générée par IA — pas besoin d'un
  // appel pour une phrase aussi courte et toujours identique) qui introduit
  // le lien en dernière ligne, pour que le destinataire du fichier audio ait
  // toujours un moyen de revenir vers la plateforme.
  const shareCta = () => t('Écoute-la ici et crée la tienne 👇', 'Listen here and create your own 👇');
  const buildFullShareText = (channel: string) => `${shareMessage}\n\n${shareCta()}\n${shareUrlFor(channel)}`;

  const [generatingMessage, setGeneratingMessage] = useState(false);
  const handleGenerateMessage = async () => {
    setGeneratingMessage(true);
    try {
      const res = await fetch(`/api/generations/${song.id}/share-message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: lang === 'en' ? 'en' : 'fr' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) setShareMessage(data.message);
      }
      // En cas d'échec (quota, réseau...), le message actuel reste inchangé —
      // jamais d'erreur bloquante pour une simple suggestion de texte.
    } finally {
      setGeneratingMessage(false);
    }
  };

  // Intègre la cover comme pochette (tag ID3) dans le MP3 plutôt que de
  // fabriquer une vidéo — quasi instantané, léger, et donne quand même un
  // seul fichier "audio + cover" pour WhatsApp/Instagram. Mémorisé après la
  // première génération pour ne pas refaire le travail à chaque clic.
  const [taggedFile, setTaggedFile] = useState<File | null>(null);
  const taggingRef = useRef<Promise<File> | null>(null);
  const [preparingShare, setPreparingShare] = useState(false);

  const getTaggedAudioFile = async (): Promise<File> => {
    if (taggedFile) return taggedFile;
    if (!taggingRef.current) {
      taggingRef.current = embedCoverArt(song.audio_url!, song.cover_url!, `${song.occasion} — Melotones`)
        .then(blob => new File([blob], 'melotones.mp3', { type: 'audio/mpeg' }));
    }
    const file = await taggingRef.current;
    setTaggedFile(file);
    return file;
  };

  const handleDownload = async () => {
    setPreparingShare(true);
    try {
      const file = song.cover_url ? await getTaggedAudioFile().catch(() => null) : null;
      const url = file ? URL.createObjectURL(file) : song.audio_url!;
      const a = document.createElement('a');
      a.href = url;
      a.download = 'melotones.mp3';
      a.click();
      if (file) setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setPreparingShare(false);
    }
  };

  const handleNativeShare = async () => {
    trackShare('native');
    setPreparingShare(true);
    try {
      if (song.cover_url) {
        try {
          const file = await getTaggedAudioFile();
          if (navigator.canShare?.({ files: [file] })) {
            // Le champ "url" séparé n'est pas fiable quand "files" est présent
            // (ignoré par beaucoup de navigateurs) — le lien doit donc être
            // dans le texte lui-même pour que le destinataire du fichier
            // audio+cover ait toujours un moyen de revenir vers le site.
            await navigator.share({ files: [file], title: 'Melotones', text: buildFullShareText('native') });
            return;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return; // partage annulé par l'utilisateur — ne rien faire d'autre
          // sinon (tag échoué, ou fichiers non supportés) : repli sur le partage du lien ci-dessous
        }
      }
      const url = shareUrlFor('native');
      if (navigator.share) { try { await navigator.share({ title: 'Melotones', text: `${shareMessage}\n\n${shareCta()}`, url }); } catch {} }
      else {
        const text = buildFullShareText('native');
        const ok = await copyToClipboard(text);
        if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
        else setCopyFallbackText(text);
      }
    } finally {
      setPreparingShare(false);
    }
  };

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
        <img decoding="async" loading="lazy" src={song.cover_url} alt="" className="w-48 h-48 mx-auto rounded-2xl object-cover shadow-lg mb-5" />
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

          <div className="mb-4 text-left space-y-2">
            <textarea
              value={shareMessage} onChange={e => setShareMessage(e.target.value)} rows={2} maxLength={280}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none"
            />
            <div className="flex gap-2 text-xs">
              <button onClick={handleGenerateMessage} disabled={generatingMessage} className="flex items-center gap-1 text-brand-600 font-semibold hover:text-brand-700 disabled:opacity-60">
                {generatingMessage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {generatingMessage ? t('Génération…', 'Generating…') : t('Générer un mot', 'Generate a message')}
              </button>
              <button onClick={() => setShareMessage(defaultMessage)} className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
                <RotateCcw className="w-3 h-3" /> {t('Réinitialiser', 'Reset')}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={handleDownload} disabled={preparingShare} className="btn-primary flex items-center gap-2 disabled:opacity-60">
              {preparingShare ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {t('Télécharger', 'Download')}
            </button>
            <button
              onClick={handleNativeShare}
              disabled={preparingShare}
              className="btn-secondary flex items-center gap-2 disabled:opacity-60"
            >{preparingShare ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} {t('Partager', 'Share')}</button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareMessage + '\n' + shareUrlFor('whatsapp'))}`}
              target="_blank" rel="noopener noreferrer" onClick={() => trackShare('whatsapp')}
              className="btn-secondary flex items-center gap-2 !bg-green-50 !text-green-700 !border-green-200 hover:!bg-green-100"
            ><MessageCircle className="w-4 h-4" /> WhatsApp</a>
            <button
              onClick={async () => {
                trackShare('copy');
                // Volontairement le lien seul, sans le message devant — un lien
                // collé avec du texte avant lui n'est plus reconnu comme une URL
                // cliquable par la plupart des apps (barre d'adresse, champs URL...).
                const text = shareUrlFor('copy');
                const ok = await copyToClipboard(text);
                if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
                else setCopyFallbackText(text);
              }}
              className="btn-secondary flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? t('Copié', 'Copied') : t('Copier le lien', 'Copy link')}
            </button>
          </div>

          {copyFallbackText && (
            <div className="mt-3 text-left">
              <p className="text-xs text-gray-500 mb-1">
                {t('La copie automatique a échoué sur ce navigateur — sélectionne le texte ci-dessous et copie-le toi-même :', "Automatic copy failed on this browser — select the text below and copy it yourself:")}
              </p>
              <input
                readOnly value={copyFallbackText} autoFocus
                onFocus={e => e.currentTarget.select()}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50"
              />
            </div>
          )}

          {!isOwner && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-3 flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-500" />
                {t('Toi aussi, crée une chanson unique pour quelqu\'un que tu aimes.', 'You too can create a unique song for someone you love.')}
              </p>
              <Link href="/signup" className="btn-primary inline-flex items-center gap-2">
                {t('Créer ma propre chanson gratuitement', 'Create my own song for free')}
              </Link>
            </div>
          )}

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
