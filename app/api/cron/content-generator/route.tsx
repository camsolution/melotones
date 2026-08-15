import { NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/admin';
import { verifyCronSecret, getAdminEmails, reportRun } from '@/lib/cron';
import { sendEmail } from '@/lib/email';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import fs from 'fs';
import path from 'path';

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

type Slide = { headline: string; caption: string };

async function generateSlides(angle: string): Promise<Slide[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY manquant');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `Tu écris du contenu marketing en français pour Melotones (melotones.co), une app qui génère des chansons personnalisées par IA (occasion + style musical + message perso -> une chanson complète), pour un public africain/diaspora.

Angle de cette semaine : "${angle}".

Génère exactement 2 variations créatives sur cet angle, au format JSON strict (rien d'autre que le JSON) :
[
  {"headline": "titre accrocheur, 2-4 mots max, percutant", "caption": "légende complète prête à poster sur Instagram/Facebook : 2-3 phrases chaleureuses en français, un emoji pertinent, terminant par 'melotones.co' et 4-5 hashtags pertinents incluant #Melotones"},
  {"headline": "...", "caption": "..."}
]

Les 2 variations doivent être différentes l'une de l'autre (angle légèrement différent ou ton différent), pas de répétition. N'invente aucun chiffre ni statistique.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`Réponse Gemini non parsable: ${text.slice(0, 200)}`);
  const slides = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(slides) || slides.length === 0) throw new Error('Gemini a renvoyé un format inattendu');
  return slides.slice(0, 2);
}

// Remplace le "subtext" auparavant inventé par Gemini par un vrai chiffre —
// cohérent avec la règle du projet de ne jamais fabriquer de statistique
// marketing (voir human_tasks / lib/canvaPromptGenerator.ts).
async function fetchWeeklyStat(): Promise<string> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('created_at', since);
  return `🎵 ${count ?? 0} chanson${(count ?? 0) === 1 ? '' : 's'} créée${(count ?? 0) === 1 ? '' : 's'} cette semaine`;
}

// Une vraie pochette d'une génération publique récente plutôt qu'une photo
// stock — cohérent avec le principe "rien d'inventé" et montre du contenu
// réellement produit par Melotones.
async function fetchRandomCoverDataUri(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('generations')
    .select('cover_url')
    .eq('is_public', true)
    .eq('status', 'completed')
    .not('cover_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (!data || data.length === 0) return null;

  const pick = data[Math.floor(Math.random() * data.length)];
  try {
    const res = await fetchWithTimeout(pick.cover_url as string, {}, 10_000);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// La police Ubuntu-Bold est déjà embarquée en TTF pour le rapport PDF
// partenaire (assets/fonts/) — la lire localement évite une dépendance
// réseau vers Google Fonts, dont la réponse CSS s'est déjà révélée instable
// en prod (échec constaté : "Police introuvable dans la réponse Google Fonts").
function loadBundledFontTtf(): ArrayBuffer {
  const buf = fs.readFileSync(path.join(process.cwd(), 'assets/fonts/Ubuntu-Bold.ttf'));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function fetchLogoDataUri(siteUrl: string): Promise<string> {
  const res = await fetch(`${siteUrl}/icon.png`);
  if (!res.ok) throw new Error('Logo introuvable');
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function renderSlide(
  slide: Slide,
  logoDataUri: string,
  fontData: ArrayBuffer,
  coverDataUri: string | null,
  statText: string
): Promise<Buffer> {
  const image = new ImageResponse(
    (
      <div
        style={{
          width: SIZE, height: SIZE, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', alignItems: 'center',
          background: `linear-gradient(135deg, ${VIOLET} 0%, ${MAGENTA} 52%, ${AMBER} 100%)`,
          padding: 60, fontFamily: 'Ubuntu',
        }}
      >
        <div style={{ display: 'flex', width: 110, height: 110, borderRadius: 24, overflow: 'hidden', alignSelf: 'flex-start' }}>
          <img src={logoDataUri} width={110} height={110} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex', color: '#ffffff', fontSize: 62, fontWeight: 700, lineHeight: 1.15,
              textAlign: 'center', background: 'rgba(21,14,41,0.55)', borderRadius: 32, padding: '30px 50px',
            }}
          >
            {slide.headline}
          </div>
          {coverDataUri && (
            <div style={{ display: 'flex', width: 300, height: 300, borderRadius: 28, overflow: 'hidden', border: `4px solid rgba(255,255,255,0.5)` }}>
              <img src={coverDataUri} width={300} height={300} style={{ objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ display: 'flex', background: 'rgba(21,14,41,0.55)', borderRadius: 24, padding: '14px 28px' }}>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.9)', fontSize: 26, fontWeight: 700 }}>{statText}</div>
          </div>
        </div>
        <div style={{ display: 'flex', background: '#ffffff', borderRadius: 40, padding: '18px 44px' }}>
          <div style={{ display: 'flex', color: INK, fontSize: 30, fontWeight: 700 }}>melotones.co</div>
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
    const fontData = loadBundledFontTtf();
    const [slides, logoDataUri, coverDataUri, statText] = await Promise.all([
      generateSlides(angle),
      fetchLogoDataUri(process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.co'),
      fetchRandomCoverDataUri(),
      fetchWeeklyStat(),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    const uploaded: { path: string; signedUrl: string; caption: string }[] = [];
    const attachments: { filename: string; content: string }[] = [];

    for (let i = 0; i < slides.length; i++) {
      const png = await renderSlide(slides[i], logoDataUri, fontData, coverDataUri, statText);

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

    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendEmail(
        adminEmails,
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
