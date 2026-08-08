import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import CreditService from '@/services/CreditService';
import MusicGenerationService from '@/services/MusicGenerationService';

// Singleton DB pour éviter de multiples connexions
let db;
function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || './melotones.db';
    db = new Database(dbPath);
    // Initialiser les tables si besoin (appel idempotent)
    const schemaPath = path.join(process.cwd(), 'db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schema);
    }
  }
  return db;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, stylePrompt, lyrics, generateLyrics, title, provider } = body;

    if (!stylePrompt) {
      return NextResponse.json({ error: 'stylePrompt est requis' }, { status: 400 });
    }

    // Ici, userId devrait provenir de l'auth. Pour le test, on accepte userId du body.
    // À remplacer par votre vrai middleware d'authentification.
    if (!userId) {
      return NextResponse.json({ error: 'userId manquant' }, { status: 400 });
    }

    const db = getDb();
    const creditService = new CreditService(db);
    const musicService = new MusicGenerationService(db, creditService);

    const result = await musicService.startGeneration({
      userId: parseInt(userId),
      providerName: provider,
      stylePrompt,
      lyrics,
      generateLyrics: !!generateLyrics,
      title,
    });

    return NextResponse.json({
      message: 'Génération lancée',
      ...result,
    }, { status: 202 });
  } catch (err) {
    if (err.code === 'CREDITS_INSUFFISANTS') {
      return NextResponse.json({ error: 'Crédits insuffisants' }, { status: 402 });
    }
    console.error('[generate] Erreur:', err);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
