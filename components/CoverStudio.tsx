'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ImagePlus, Check, Loader2, Headphones, Wand2, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';
import { coverTemplates, suggestedTemplate, CoverTemplate } from '@/lib/coverTemplates';
import { getAnimationKind, GIF_FRAME_COUNT, GIF_FPS, GIF_SIZE } from '@/lib/coverAnimations';

const SIZE = 1080;

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function renderBase(
  ctx: CanvasRenderingContext2D,
  size: number,
  template: CoverTemplate,
  photo: HTMLImageElement | null,
  occasionLabel: string,
  styleLabel: string,
  displayFont: string,
  sansFont: string
) {
  ctx.clearRect(0, 0, size, size);

  const angle = (template.angleDeg * Math.PI) / 180;
  const x1 = size / 2 - (Math.cos(angle) * size) / 2;
  const y1 = size / 2 - (Math.sin(angle) * size) / 2;
  const x2 = size / 2 + (Math.cos(angle) * size) / 2;
  const y2 = size / 2 + (Math.sin(angle) * size) / 2;
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, template.bg[0]);
  grad.addColorStop(1, template.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (template.photoShape === 'fullBleed' && photo) {
    drawCover(ctx, photo, 0, 0, size, size);
    if (template.overlay === 'bottomFade') {
      const fade = ctx.createLinearGradient(0, size * 0.4, 0, size);
      fade.addColorStop(0, 'rgba(21,14,41,0)');
      fade.addColorStop(1, 'rgba(21,14,41,0.85)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, size, size);
    }
  } else if (template.photoShape === 'diagonal') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(size * 0.42, 0);
    ctx.lineTo(size, 0);
    ctx.lineTo(size, size);
    ctx.lineTo(size * 0.68, size);
    ctx.closePath();
    ctx.clip();
    if (photo) drawCover(ctx, photo, size * 0.3, 0, size * 0.7, size);
    else { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 0, size, size); }
    ctx.restore();
  } else if (template.photoShape === 'circle') {
    const r = size * 0.27;
    const cx = size / 2;
    const cy = size * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    if (photo) {
      ctx.clip();
      drawCover(ctx, photo, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();
      ctx.restore();
      ctx.font = `${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎵', cx, cy + r * 0.05);
    }
    if (template.overlay === 'ring') {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
      ctx.strokeStyle = template.accentColor;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = template.textColor;

  const textY = template.photoShape === 'circle' ? size * 0.72 : size * 0.84;
  ctx.font = `800 ${size * 0.059}px ${displayFont}`;
  ctx.fillText(occasionLabel, size / 2, textY);

  ctx.font = `700 ${size * 0.0315}px ${sansFont}`;
  ctx.fillStyle = template.accentColor;
  ctx.fillText(styleLabel.toUpperCase(), size / 2, textY + size * 0.052);

  ctx.font = `700 ${size * 0.024}px ${sansFont}`;
  ctx.fillStyle = template.textColor;
  ctx.globalAlpha = 0.55;
  ctx.fillText('MELOTONES', size / 2, size - size * 0.04);
  ctx.globalAlpha = 1;
}

function drawConfettiFrame(ctx: CanvasRenderingContext2D, size: number, t: number) {
  const colors = ['#F23D82', '#FFB23E', '#8B5CF6', '#FFFFFF'];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const seed = i / count;
    const x = (seed * size + Math.sin(seed * 40) * size * 0.03) % size;
    const fallSpeed = 0.6 + (i % 5) * 0.15;
    const y = ((t * fallSpeed + seed) % 1) * (size + size * 0.06) - size * 0.03;
    const rot = (t * 360 * (1 + (i % 3) * 0.4) + seed * 360) % 360;
    const w = size * (0.008 + (i % 3) * 0.003);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-w / 2, -w / 3, w, w * 0.6);
    ctx.restore();
  }
}

function drawSparkleFrame(ctx: CanvasRenderingContext2D, size: number, t: number) {
  const count = 14;
  for (let i = 0; i < count; i++) {
    const seed = i / count;
    const x = size * (0.15 + 0.7 * ((seed * 7) % 1));
    const y = size * (0.12 + 0.55 * ((seed * 13) % 1));
    const phase = (t + seed) % 1;
    const alpha = Math.sin(phase * Math.PI);
    const r = size * (0.004 + (i % 3) * 0.002);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGlowFrame(ctx: CanvasRenderingContext2D, size: number, t: number) {
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
  const r = size * (0.35 + 0.08 * pulse);
  const grad = ctx.createRadialGradient(size / 2, size * 0.4, r * 0.2, size / 2, size * 0.4, r);
  grad.addColorStop(0, `rgba(255,255,255,${0.22 * pulse})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
}

export default function CoverStudio({
  generationId,
  occasion,
  style,
  initialCoverUrl,
  onSaved,
}: {
  generationId: string;
  occasion: string;
  style: string;
  initialCoverUrl: string | null;
  onSaved?: (coverUrl: string) => void;
}) {
  const { lang, t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fontProbeRef = useRef<HTMLSpanElement>(null);
  const photoImgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [template, setTemplate] = useState<CoverTemplate>(() => suggestedTemplate(occasion));
  const [fontsReady, setFontsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(initialCoverUrl);
  const [error, setError] = useState('');
  const [animating, setAnimating] = useState(false);
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null);
  const [savingGif, setSavingGif] = useState(false);

  const occasionLabel = occasionTranslations[occasion]?.[lang] ?? occasion;
  const styleLabel = styleTranslations[style]?.[lang] ?? style;
  const animKind = getAnimationKind(occasion);

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  const getFontFamily = (weight: 'display' | 'sans') => {
    const el = fontProbeRef.current;
    if (!el) return 'sans-serif';
    el.className = weight === 'display' ? 'font-display' : 'font-sans';
    return getComputedStyle(el).fontFamily || 'sans-serif';
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderBase(ctx, SIZE, template, photoImgRef.current, occasionLabel, styleLabel, getFontFamily('display'), getFontFamily('sans'));
  }, [template, occasionLabel, styleLabel]);

  useEffect(() => {
    if (fontsReady) draw();
  }, [fontsReady, draw]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError(t('Photo trop lourde (8 Mo max).', 'Photo too large (8MB max).'));
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { photoImgRef.current = img; draw(); setGifPreviewUrl(null); };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError('');
    canvas.toBlob(async (blob) => {
      if (!blob) { setSaving(false); return; }
      try {
        const form = new FormData();
        form.append('cover', blob, 'cover.png');
        const res = await fetch(`/api/generations/${generationId}/cover`, { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        setSavedUrl(data.cover_url);
        onSaved?.(data.cover_url);
      } catch (err: any) {
        setError(err.message || t('Échec de l\'enregistrement', 'Save failed'));
      } finally {
        setSaving(false);
      }
    }, 'image/png', 0.92);
  };

  const handleGenerateGif = async () => {
    setAnimating(true);
    setError('');
    setGifPreviewUrl(null);
    try {
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
      const off = document.createElement('canvas');
      off.width = GIF_SIZE;
      off.height = GIF_SIZE;
      const ctx = off.getContext('2d')!;
      const displayFont = getFontFamily('display');
      const sansFont = getFontFamily('sans');
      const gif = GIFEncoder();
      const delay = Math.round(1000 / GIF_FPS);

      for (let i = 0; i < GIF_FRAME_COUNT; i++) {
        const progress = i / GIF_FRAME_COUNT;
        renderBase(ctx, GIF_SIZE, template, photoImgRef.current, occasionLabel, styleLabel, displayFont, sansFont);
        if (animKind === 'confetti') drawConfettiFrame(ctx, GIF_SIZE, progress);
        else if (animKind === 'sparkle') drawSparkleFrame(ctx, GIF_SIZE, progress);
        else drawGlowFrame(ctx, GIF_SIZE, progress);

        const { data } = ctx.getImageData(0, 0, GIF_SIZE, GIF_SIZE);
        const palette = quantize(data, 128);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, GIF_SIZE, GIF_SIZE, { palette, delay });
        // laisse respirer le thread principal entre les frames
        await new Promise((r) => setTimeout(r, 0));
      }
      gif.finish();
      const bytes = Uint8Array.from(gif.bytesView());
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' });
      setGifPreviewUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setError(err.message || t('Échec de la génération', 'Generation failed'));
    } finally {
      setAnimating(false);
    }
  };

  const handleSaveGif = async () => {
    if (!gifPreviewUrl) return;
    setSavingGif(true);
    setError('');
    try {
      const blob = await fetch(gifPreviewUrl).then((r) => r.blob());
      const form = new FormData();
      form.append('cover', blob, 'cover.gif');
      const res = await fetch(`/api/generations/${generationId}/cover`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved?.(data.cover_url);
    } catch (err: any) {
      setError(err.message || t('Échec de l\'enregistrement', 'Save failed'));
    } finally {
      setSavingGif(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-gray-200 bg-white shadow-sm p-6 mt-6 text-left">
      <span ref={fontProbeRef} className="absolute opacity-0 pointer-events-none" aria-hidden />
      <div className="flex items-center gap-2 mb-4">
        <ImagePlus className="w-5 h-5 text-brand-600" />
        <h3 className="font-display font-bold text-gray-800">{t('Cover personnalisée', 'Custom cover')}</h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-none w-full sm:w-64 space-y-3">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="w-full aspect-square rounded-2xl border border-gray-200"
          />
          {gifPreviewUrl && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('Aperçu animé', 'Animated preview')}</p>
              <img decoding="async" loading="lazy" src={gifPreviewUrl} alt="" className="w-full aspect-square rounded-2xl border border-brand-200" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Modèle', 'Template')}</p>
            <div className="flex flex-wrap gap-2">
              {coverTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => { setTemplate(tpl); setGifPreviewUrl(null); }}
                  className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold border-2 transition-colors ${
                    template.id === tpl.id ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-gray-200 text-gray-600 hover:border-brand-200'
                  }`}
                >
                  {t(tpl.name.fr, tpl.name.en)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Photo (optionnel)', 'Photo (optional)')}</p>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm flex items-center gap-2">
              <ImagePlus className="w-4 h-4" /> {t('Importer une photo', 'Upload a photo')}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedUrl ? <Check className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
              {saving ? t('Enregistrement...', 'Saving...') : savedUrl ? t('Cover enregistrée — mettre à jour', 'Cover saved — update') : t('Enregistrer cette cover', 'Save this cover')}
            </button>

            {!gifPreviewUrl ? (
              <button
                onClick={handleGenerateGif}
                disabled={animating}
                className="text-sm font-bold flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-60"
              >
                {animating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {animating ? t('Animation en cours...', 'Animating...') : t('Créer une cover animée', 'Create an animated cover')}
              </button>
            ) : (
              <button
                onClick={handleSaveGif}
                disabled={savingGif}
                className="text-sm font-bold flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-magenta-500 text-white disabled:opacity-60"
              >
                {savingGif ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {savingGif ? t('Enregistrement...', 'Saving...') : t('Enregistrer la version animée', 'Save animated version')}
              </button>
            )}
          </div>

          {savedUrl && !saving && (
            <a
              href={savedUrl} download
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full px-3 py-1.5"
              title={t('Enregistre juste l\'image sur ton téléphone — sans le son, pour la publier telle quelle', 'Saves just the image to your phone — without the audio, to post it as-is')}
            >
              <Download className="w-3.5 h-3.5" />
              {t('Enregistrer juste l\'image (sans le son)', 'Save just the image (no audio)')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
