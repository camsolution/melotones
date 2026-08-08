class CreditService {
  constructor(db) {
    this.db = db;
  }
  getBalance(userId) {
    const row = this.db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
    if (!row) throw new Error(`Utilisateur ${userId} introuvable`);
    return row.credits;
  }
  hasEnoughCredits(userId, amount) {
    return this.getBalance(userId) >= amount;
  }
  chargeForGeneration(userId, amount, songGenerationId = null) {
    const charge = this.db.transaction(() => {
      const balance = this.getBalance(userId);
      if (balance < amount) throw new Error('CREDITS_INSUFFISANTS');
      const newBalance = balance - amount;
      this.db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(newBalance, userId);
      const result = this.db.prepare(
        `INSERT INTO credit_transactions
         (user_id, amount, reason, song_generation_id, balance_after)
         VALUES (?, ?, 'generation_charge', ?, ?)`
      ).run(userId, -amount, songGenerationId, newBalance);
      return result.lastInsertRowid;
    });
    return charge();
  }
  refundForFailedGeneration(userId, amount, songGenerationId) {
    const refund = this.db.transaction(() => {
      const existing = this.db.prepare(
        `SELECT id FROM credit_transactions
         WHERE song_generation_id = ? AND reason = 'generation_refund'`
      ).get(songGenerationId);
      if (existing) return existing.id;
      const balance = this.getBalance(userId);
      const newBalance = balance + amount;
      this.db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(newBalance, userId);
      const result = this.db.prepare(
        `INSERT INTO credit_transactions
         (user_id, amount, reason, song_generation_id, balance_after)
         VALUES (?, ?, 'generation_refund', ?, ?)`
      ).run(userId, amount, songGenerationId, newBalance);
      this.db.prepare('UPDATE song_generations SET credits_refunded = ? WHERE id = ?')
        .run(amount, songGenerationId);
      return result.lastInsertRowid;
    });
    return refund();
  }
}

module.exports = CreditService;
