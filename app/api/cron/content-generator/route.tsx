import { NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/admin';
import { verifyCronSecret, getAdminEmail, reportRun } from '@/lib/cron';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const VIOLET = '#8b5cf6';
const MAGENTA = '#f23d82';
const AMBER = '#ffb23e';
const INK = '#150E29';
const SIZE = 1080;

const ANGLES = [
  'cadeau original et surprenant',
  'anniversaire',
  'mariage',
  'diaspora — envoyer une chanson à la famille au pays',
  'juste pour faire plaisir, sans occasion particulière',
  'fête des mères',
  'Tabaski',
  'Noël',
  'Saint-Valentin',
  'nouvelle année / bonnes résolutions',
];

function pickWeeklyAngle(): string {
  const weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  return ANGLES[weeksSinceEpoch % ANGLES.length];
}

type Slide = { headline: string; subtext: string; caption: string };

async function generateSlides(angle: string): Promise<Slide[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY manquant');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `Tu écris du contenu marketing en français pour Melotones (melotones.co), une app qui génère des chansons personnalisées par IA (occasion + style musical + message perso -> une chanson complète), pour un public africain/diaspora.

Angle de cette semaine : "${angle}".

Génère exactement 2 variations créatives sur cet angle, au format JSON strict (rien d'autre que le JSON) :
[
  {"headline": "titre accrocheur, 2-4 mots max, percutant", "subtext": "sous-texte court, une phrase, 6-10 mots max", "caption": "légende complète prête à poster sur Instagram/Facebook : 2-3 phrases chaleureuses en français, un emoji pertinent, terminant par 'melotones.co' et 4-5 hashtags pertinents incluant #Melotones"},
  {"headline": "...", "subtext": "...", "caption": "..."}
]

Les 2 variations doivent être différentes l'une de l'autre (angle légèrement différent ou ton différent), pas de répétition.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`Réponse Gemini non parsable: ${text.slice(0, 200)}`);
  const slides = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(slides) || slides.length === 0) throw new Error('Gemini a renvoyé un format inattendu');
  return slides.slice(0, 2);
}

// Google Fonts sert du TTF (au lieu de woff2) aux user-agents anciens qui ne
// déclarent pas le supporter — satori (utilisé par ImageResponse) ne lit que
// truetype/opentype, pas woff2.
async function fetchGoogleFontTtf(family: string, weight: number): Promise<ArrayBuffer> {
  const cssRes = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36' },
  });
  const css = await cssRes.text();
  const match = css.match(/url\((https:\/\/[^)]+\.ttf)\)/);
  if (!match) throw new Error('Police introuvable dans la réponse Google Fonts');
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

async function fetchLogoDataUri(siteUrl: string): Promise<string> {
  const res = await fetch(`${siteUrl}/icon.png`);
  if (!res.ok) throw new Error('Logo introuvable');
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function renderSlide(slide: Slide, logoDataUri: string, fontData: ArrayBuffer): Promise<Buffer> {
  const image = new ImageResponse(
    (
      <div
        style={{
          width: SIZE, height: SIZE, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', alignItems: 'center',
          background: `linear-gradient(135deg, ${VIOLET} 0%, ${MAGENTA} 52%, ${AMBER} 100%)`,
          padding: 70, fontFamily: 'Ubuntu',
        }}
      >
        <div style={{ display: 'flex', width: 130, height: 130, borderRadius: 28, overflow: 'hidden', alignSelf: 'flex-start' }}>
          <img src={logoDataUri} width={130} height={130} />
        </div>
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            background: 'rgba(21,14,41,0.55)', borderRadius: 36, padding: '50px 60px', gap: 22,
          }}
        >
          <div style={{ display: 'flex', color: '#ffffff', fontSize: 72, fontWeight: 700, lineHeight: 1.15 }}>
            {slide.headline}
          </div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 30 }}>
            {slide.subtext}
          </div>
        </div>
        <div style={{ display: 'flex', background: '#ffffff', borderRadius: 40, padding: '20px 46px' }}>
          <div style={{ display: 'flex', color: INK, fontSize: 32, fontWeight: 700 }}>melotones.co</div>
        </div>
      </div>
    ),
    {
      width: SIZE, height: SIZE,
      fonts: [{ name: 'Ubuntu', data: fontData, weight: 700, style: 'normal' }],
    }
  );
  return Buffer.from(await image.arrayBuffer());
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const angle = pickWeeklyAngle();
    const [slides, fontData, logoDataUri] = await Promise.all([
      generateSlides(angle),
      fetchGoogleFontTtf('Ubuntu', 700),
      fetchLogoDataUri(process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.co'),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    const uploaded: { path: string; signedUrl: string; caption: string }[] = [];
    const attachments: { filename: string; content: string }[] = [];

    for (let i = 0; i < slides.length; i++) {
      const png = await renderSlide(slides[i], logoDataUri, fontData);

      const path = `${dateStr}-${i + 1}.png`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('marketing-content')
        .upload(path, png, { contentType: 'image/png', upsert: true });
      if (uploadError) throw new Error(`Upload image ${i + 1} échoué: ${uploadError.message}`);

      const { data: signed } = await supabaseAdmin.storage
        .from('marketing-content')
        .createSignedUrl(path, 30 * 24 * 60 * 60);

      uploaded.push({ path, signedUrl: signed?.signedUrl || '', caption: slides[i].caption });
      attachments.push({ filename: `melotones-${path}`, content: png.toString('base64') });
    }

    const summaryText = `Angle "${angle}" — 2 visuels générés.`;

    const adminEmail = await getAdminEmail();
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        `Contenu réseaux sociaux Melotones — ${dateStr}`,
        `<h2>Nouveaux visuels — angle "${angle}"</h2>
         ${uploaded.map((u, i) => `<p><strong>Visuel ${i + 1}</strong> (en pièce jointe)<br>Légende suggérée : ${slides[i].caption}</p>`).join('')}
         <p style="color:#888;font-size:12px;">Prêts à poster manuellement sur TikTok/Instagram/Facebook/YouTube — aucune publication automatique n'est faite.</p>`,
        attachments
      );
    }

    await reportRun('content-generator', 'success', summaryText, { angle, slides: uploaded });
    return NextResponse.json({ ok: true, angle, slides: uploaded });
  } catch (err: any) {
    await reportRun('content-generator', 'failure', `Échec : ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
