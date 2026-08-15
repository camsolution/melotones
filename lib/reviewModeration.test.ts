import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moderateUserReview } from './reviewModeration';

// Mocks des modules externes
vi.mock('@/lib/admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(),
              then: vi.fn(),
            })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/humanTasks', () => ({
  createHumanTask: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/cron', () => ({
  getAdminEmails: vi.fn().mockResolvedValue(['admin@melotones.co']),
}));

vi.mock('./moderation', () => ({
  classifyMessage: vi.fn(),
}));

import { supabaseAdmin } from '@/lib/admin';
import { sendEmail } from '@/lib/email';
import { createHumanTask } from '@/lib/humanTasks';
import { getAdminEmails } from '@/lib/cron';
import { classifyMessage } from './moderation';

// Helper pour simuler une réponse de supabaseAdmin.from('testimonials')...
function mockDuplicateData(data: any[]) {
  const queryChain = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data })),
        })),
      })),
    })),
  };
  (supabaseAdmin.from as any).mockReturnValue(queryChain);
}

describe('moderateUserReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut, pas de doublon
    mockDuplicateData([]);
    // Par défaut, classifyMessage retourne ALLOW
    (classifyMessage as any).mockResolvedValue({ category: 'ALLOW', reason: 'ok' });
  });

  it('avis positif -> ALLOW, pas d\'alerte', async () => {
    const decision = await moderateUserReview({
      reviewType: 'PLATFORM',
      text: "J'adore Melotones.",
      rating: 5,
      userId: 'user1',
    });

    expect(decision.action).toBe('ALLOW');
    expect(decision.severity).toBe('NONE');
    expect(decision.adminAlertRequired).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createHumanTask).not.toHaveBeenCalled();
  });

  it('avis négatif légitime -> ALLOW', async () => {
    const decision = await moderateUserReview({
      reviewType: 'PLATFORM',
      text: 'Je trouve la génération trop lente.',
      rating: 2,
      userId: 'user1',
    });

    expect(decision.action).toBe('ALLOW');
    expect(decision.severity).toBe('NONE');
    expect(decision.adminAlertRequired).toBe(false);
  });

  it('critique commerciale -> ALLOW', async () => {
    const decision = await moderateUserReview({
      reviewType: 'PLATFORM',
      text: 'Le prix est trop élevé pour moi.',
      rating: 2,
      userId: 'user1',
    });

    expect(decision.action).toBe('ALLOW');
  });

  it('critique sévère -> ALLOW', async () => {
    const decision = await moderateUserReview({
      reviewType: 'PLATFORM',
      text: 'Je suis très déçu du résultat.',
      rating: 1,
      userId: 'user1',
    });

    expect(decision.action).toBe('ALLOW');
  });

  it('insulte ciblée -> HUMAN_REVIEW', async () => {
    (classifyMessage as any).mockResolvedValue({ category: 'HUMAN_REVIEW', reason: 'insulte ciblée' });

    const decision = await moderateUserReview({
      reviewType: 'PLATFORM',
      text: 'Espèce d\'imbécile, tu as raté ma chanson.',
      rating: 1,
      userId: 'user1',
    });

    expect(decision.action).toBe('HUMAN_REVIEW');
    expect(createHumanTask).toHaveBeenCalled();
  });

  it('menace -> HIDE_AND_ALERT_ADMIN, alerte admin', async () => {
    (classifyMessage as any).mockResolvedValue({ category: 'BLOCK', reason: 'menace crédible' });

    const decision = await moderateUserReview({
      reviewType: 'PLATFORM',
      text: 'Je vais te retrouver et te faire du mal.',
      rating: 1,
      userId: 'user1',
    });

    expect(decision.action).toBe('HIDE_AND_ALERT_ADMIN');
    expect(decision.adminAlertRequired).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
    expect(createHumanTask).toHaveBeenCalled();
  });

  it('spam -> HUMAN_REVIEW', async () => {
    // Texte avec répétition pour déclencher la détection de spam
    const decision = await moderateUserReview({
      reviewType: 'PLATFORM',
      text: 'spam spam spam spam spam spam spam spam',
      rating: 3,
      userId: 'user1',
    });

    expect(decision.action).toBe('HUMAN_REVIEW');
    expect(decision.categories).toContain('SPAM');
  });

  it('données personnelles -> HIDE_AND_ALERT_ADMIN', async () => {
    const decision = await moderateUserReview({
      reviewType: 'PLATFORM',
      text: 'Mon adresse est 12 rue des Lilas, mon email test@test.com',
      rating: 3,
      userId: 'user1',
    });

    expect(decision.action).toBe('HIDE_AND_ALERT_ADMIN');
    expect(decision.categories).toContain('PERSONAL_DATA');
    expect(decision.adminAlertRequired).toBe(true);
  });
});
