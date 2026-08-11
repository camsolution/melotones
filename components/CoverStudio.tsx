'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ImagePlus, Check, Loader2, Headphones } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionTranslations, styleTranslations } from '@/lib/listTranslations';
import { coverTemplates, suggestedTemplate, CoverTemplate } from '@/lib/coverTemplates';

const SIZE = 1080;

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

  const occasionLabel = occasionTranslations[occasion]?.[lang] ?? occasion;
  const styleLabel = styleTranslations[style]?.[lang] ?? style;

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  const getFontFamily = (weight: 'display' | 'sans') => {
    const el = fontProbeRef.current;
    if (!el) return weight === 'display' ? 'sans-serif' : 'sans-serif';
    el.className = weight === 'display' ? 'font-display' : 'font-sans';
    return getComputedStyle(el).fontFamily || 'sans-serif';
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background gradient
    const angle = (template.angleDeg * Math.PI) / 180;
    const x1 = SIZE / 2 - (Math.cos(angle) * SIZE) / 2;
    const y1 = SIZE / 2 - (Math.sin(angle) * SIZE) / 2;
    const x2 = SIZE / 2 + (Math.cos(angle) * SIZE) / 2;
    const y2 = SIZE / 2 + (Math.sin(angle) * SIZE) / 2;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, template.bg[0]);
    grad.addColorStop(1, template.bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const photo = photoImgRef.current;

    if (template.photoShape === 'fullBleed' && photo) {
      drawCover(ctx, photo, 0, 0, SIZE, SIZE);
      if (template.overlay === 'bottomFade') {
        const fade = ctx.createLinearGradient(0, SIZE * 0.4, 0, SIZE);
        fade.addColorStop(0, 'rgba(21,14,41,0)');
        fade.addColorStop(1, 'rgba(21,14,41,0.85)');
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }
    } else if (template.photoShape === 'diagonal') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(SIZE * 0.42, 0);
      ctx.lineTo(SIZE, 0);
      ctx.lineTo(SIZE, SIZE);
      ctx.lineTo(SIZE * 0.68, SIZE);
      ctx.closePath();
      ctx.clip();
      if (photo) drawCover(ctx, photo, SIZE * 0.3, 0, SIZE * 0.7, SIZE);
      else { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 0, SIZE, SIZE); }
      ctx.restore();
    } else if (template.photoShape === 'circle') {
      const r = SIZE * 0.27;
      const cx = SIZE / 2;
      const cy = SIZE * 0.4;
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

    // Text
    const displayFont = getFontFamily('display');
    const sansFont = getFontFamily('sans');
    ctx.textAlign = 'center';
    ctx.fillStyle = template.textColor;

    const textY = template.photoShape === 'circle' ? SIZE * 0.72 : SIZE * 0.84;
    ctx.font = `800 64px ${displayFont}`;
    ctx.fillText(occasionLabel, SIZE / 2, textY);

    ctx.font = `700 34px ${sansFont}`;
    ctx.fillStyle = template.accentColor;
    ctx.fillText(styleLabel.toUpperCase(), SIZE / 2, textY + 56);

    // Small watermark
    ctx.font = `700 26px ${sansFont}`;
    ctx.fillStyle = template.textColor;
    ctx.globalAlpha = 0.55;
    ctx.fillText('MELOTONES', SIZE / 2, SIZE - 44);
    ctx.globalAlpha = 1;
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
      img.onload = () => { photoImgRef.current = img; draw(); };
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

  return (
    <div className="rounded-[24px] border border-gray-200 bg-white shadow-sm p-6 mt-6 text-left">
      <span ref={fontProbeRef} className="absolute opacity-0 pointer-events-none" aria-hidden />
      <div className="flex items-center gap-2 mb-4">
        <ImagePlus className="w-5 h-5 text-brand-600" />
        <h3 className="font-display font-bold text-gray-800">{t('Cover personnalisée', 'Custom cover')}</h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="w-full sm:w-64 aspect-square rounded-2xl border border-gray-200 flex-none"
        />

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Modèle', 'Template')}</p>
            <div className="flex flex-wrap gap-2">
              {coverTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplate(tpl)}
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

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedUrl ? <Check className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
            {saving ? t('Enregistrement...', 'Saving...') : savedUrl ? t('Cover enregistrée — mettre à jour', 'Cover saved — update') : t('Enregistrer cette cover', 'Save this cover')}
          </button>
          {savedUrl && !saving && (
            <a href={savedUrl} download className="text-xs text-brand-600 font-semibold hover:underline">
              {t('Télécharger l\'image', 'Download image')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

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
