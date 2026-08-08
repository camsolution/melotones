import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import CreditService from '@/services/CreditService';
import MusicGenerationService from '@/services/MusicGenerationService';

let db;
function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || './melotones.db';
    db = new Database(dbPath);
  }
  return db;
}

export async function GET(req, { params }) {
  try {
    const { id } = params;
    const userId = req.headers.get('x-user-id') || req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié (userId requis)' }, { status: 401 });
    }

    const db = getDb();
    const creditService = new CreditService(db);
    const musicService = new MusicGenerationService(db, creditService);

    const gen = await musicService.refreshStatus(parseInt(id));
    if (gen.user_id !== parseInt(userId)) {
      return NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
    }

    return NextResponse.json({
      id: gen.id,
      status: gen.status,
      audioUrl: gen.audio_url,
      durationMs: gen.duration_ms,
      errorMessage: gen.error_message,
      provider: gen.provider,
    });
  } catch (err) {
    console.error('[song] Erreur:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
