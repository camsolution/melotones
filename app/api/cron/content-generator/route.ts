import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/admin';
import { verifyCronSecret, getAdminEmail, reportRun } from '@/lib/cron';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const VIOLET = '#8b5cf6';
const MAGENTA = '#f23d82';
const AMBER = '#ffb23e';
const INK = '#150E29';
const W = 1080, H = 1080;

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

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSvg(slide: Slide): string {
  const headlineLines = slide.headline.split(' ').reduce<string[]>((lines, word) => {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= 14) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
    return lines;
  }, []);

  const headlineSvg = headlineLines.slice(0, 3).map((line, i) =>
    `<text x="540" y="${520 + i * 90}" text-anchor="middle" font-family="Ubuntu" font-weight="bold" font-size="76" fill="#ffffff">${escapeXml(line)}</text>`
  ).join('');

  return `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${VIOLET}"/>
        <stop offset="52%" stop-color="${MAGENTA}"/>
        <stop offset="100%" stop-color="${AMBER}"/>
      </linearGradient>
      <radialGradient id="glow1" cx="20%" cy="15%" r="55%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="${INK}" flood-opacity="0.3"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect width="${W}" height="${H}" fill="url(#glow1)"/>
    <rect x="70" y="420" width="940" height="440" rx="36" fill="${INK}" opacity="0.55" filter="url(#soft)"/>
    ${headlineSvg}
    <text x="540" y="${520 + headlineLines.length * 90 + 20}" text-anchor="middle" font-family="Ubuntu" font-size="30" fill="#ffffff" opacity="0.85">${escapeXml(slide.subtext)}</text>
    <rect x="360" y="950" width="360" height="80" rx="40" fill="#ffffff"/>
    <text x="540" y="1000" text-anchor="middle" font-family="Ubuntu" font-weight="bold" font-size="30" fill="${INK}">melotones.co</text>
  </svg>`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const angle = pickWeeklyAngle();
    const slides = await generateSlides(angle);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.co';
    const logoRes = await fetch(`${siteUrl}/icon.png`);
    if (!logoRes.ok) throw new Error('Logo introuvable');
    const logoBuffer = Buffer.from(await logoRes.arrayBuffer());
    const logoResized = await sharp(logoBuffer).resize(280, 280).toBuffer();

    const dateStr = new Date().toISOString().slice(0, 10);
    const uploaded: { path: string; signedUrl: string; caption: string }[] = [];
    const attachments: { filename: string; content: string }[] = [];

    for (let i = 0; i < slides.length; i++) {
      const svg = buildSvg(slides[i]);
      const png = await sharp(Buffer.from(svg))
        .composite([{ input: logoResized, top: 60, left: (W - 280) / 2 }])
        .resize(W * 2, H * 2)
        .png()
        .toBuffer();

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
