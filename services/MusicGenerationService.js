const { getProvider } = require('../providers');

class MusicGenerationService {
  constructor(db, creditService) {
    this.db = db;
    this.creditService = creditService;
  }

  async startGeneration({ userId, providerName, stylePrompt, lyrics, generateLyrics = false, title }) {
    const provider = getProvider(providerName || process.env.MELOTONES_DEFAULT_PROVIDER || 'mureka');
    if (!this.creditService.hasEnoughCredits(userId, provider.creditCost)) {
      const err = new Error('Crédits insuffisants');
      err.code = 'CREDITS_INSUFFISANTS';
      throw err;
    }
    const insertResult = this.db.prepare(
      `INSERT INTO song_generations
       (user_id, provider, provider_task_id, status, title, style_prompt, lyrics, credits_charged)
       VALUES (?, ?, '', 'pending', ?, ?, ?, ?)`
    ).run(userId, provider.name, title || null, stylePrompt, lyrics || null, provider.creditCost);
    const songGenerationId = insertResult.lastInsertRowid;
    try {
      this.creditService.chargeForGeneration(userId, provider.creditCost, songGenerationId);
      const { taskId } = await provider.generate({ lyrics, stylePrompt, generateLyrics, title });
      this.db.prepare(
        `UPDATE song_generations
         SET provider_task_id = ?, status = 'processing', updated_at = datetime('now')
         WHERE id = ?`
      ).run(taskId, songGenerationId);
      return { songGenerationId, taskId, provider: provider.name };
    } catch (err) {
      this._markFailed(songGenerationId, userId, provider.creditCost, err.message);
      throw err;
    }
  }

  async refreshStatus(songGenerationId) {
    const gen = this.db.prepare('SELECT * FROM song_generations WHERE id = ?').get(songGenerationId);
    if (!gen) throw new Error(`Génération ${songGenerationId} introuvable`);
    if (gen.status === 'completed' || gen.status === 'failed') return gen;
    const provider = getProvider(gen.provider);
    const result = await provider.checkStatus(gen.provider_task_id);
    this.db.prepare(
      `UPDATE song_generations
       SET poll_attempts = poll_attempts + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).run(songGenerationId);
    if (result.status === 'completed') {
      this.db.prepare(
        `UPDATE song_generations
         SET status = 'completed', audio_url = ?, duration_ms = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(result.audioUrl, result.duration || null, songGenerationId);
    } else if (result.status === 'failed') {
      this._markFailed(songGenerationId, gen.user_id, gen.credits_charged, result.error);
    } else if (result.status === 'processing' && gen.status === 'pending') {
      this.db.prepare(`UPDATE song_generations SET status = 'processing' WHERE id = ?`).run(songGenerationId);
    }
    return this.db.prepare('SELECT * FROM song_generations WHERE id = ?').get(songGenerationId);
  }

  _markFailed(songGenerationId, userId, creditsToRefund, errorMessage) {
    this.db.prepare(
      `UPDATE song_generations
       SET status = 'failed', error_message = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(errorMessage || 'Erreur inconnue', songGenerationId);
    this.creditService.refundForFailedGeneration(userId, creditsToRefund, songGenerationId);
  }

  getPendingGenerations() {
    return this.db.prepare(
      `SELECT * FROM song_generations
       WHERE status IN ('pending', 'processing')
       ORDER BY created_at ASC`
    ).all();
  }
}

module.exports = MusicGenerationService;
