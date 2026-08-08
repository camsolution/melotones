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

export async function GET() {
  try {
    const db = getDb();
    const creditService = new CreditService(db);
    const musicService = new MusicGenerationService(db, creditService);

    const pending = musicService.getPendingGenerations();
    const results = [];

    for (const gen of pending) {
      if (gen.poll_attempts >= 60) {
        musicService._markFailed(gen.id, gen.user_id, gen.credits_charged, 'Timeout max atteint');
        results.push({ id: gen.id, status: 'failed', reason: 'timeout' });
        continue;
      }
      // Backoff : les 12 premières tentatives à fond, puis 1 sur 3
      if (gen.poll_attempts > 12 && gen.poll_attempts % 3 !== 0) continue;

      try {
        const updated = await musicService.refreshStatus(gen.id);
        results.push({ id: gen.id, status: updated.status });
      } catch (err) {
        console.error(`Poll erreur #${gen.id}:`, err.message);
        results.push({ id: gen.id, error: err.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    console.error('[poll] Erreur:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
