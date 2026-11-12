import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  getBaseUrl: () => 'https://test.encave.ch',
}));

const notificationPreferences = {
  upsert: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
};
const clientEmailPreference = {
  upsert: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
};
vi.mock('@/server/db', () => ({
  db: { notificationPreferences, clientEmailPreference },
}));

const {
  getWineryUnsubscribeUrl,
  applyWineryUnsubscribe,
  getClientUnsubscribe,
  applyClientUnsubscribe,
  parseWineryUnsubscribeType,
  WINERY_TOKEN_VALIDITY_DAYS,
} = await import('@/server/services/email-preferences.service');

const NOW = new Date('2026-11-16T06:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY);

describe('email-preferences.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseWineryUnsubscribeType', () => {
    it('keeps the known scopes and falls back to "all"', () => {
      expect(parseWineryUnsubscribeType('daily_digest')).toBe('daily_digest');
      expect(parseWineryUnsubscribeType('weekly_summary')).toBe(
        'weekly_summary'
      );
      expect(parseWineryUnsubscribeType(null)).toBe('all');
      // Never reflected back into the redirect URL.
      expect(parseWineryUnsubscribeType('<script>')).toBe('all');
    });
  });

  describe('getWineryUnsubscribeUrl (producer)', () => {
    it('creates the preferences row for a winery that has none', async () => {
      notificationPreferences.upsert.mockResolvedValue({
        unsubscribeToken: 'tok-new',
        unsubscribeTokenExpiresAt: daysFromNow(WINERY_TOKEN_VALIDITY_DAYS),
      });

      const url = await getWineryUnsubscribeUrl(
        'winery-1',
        'daily_digest',
        null,
        NOW
      );

      expect(url).toBe(
        'https://test.encave.ch/api/unsubscribe/tok-new?type=daily_digest'
      );
      expect(notificationPreferences.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wineryId: 'winery-1' },
          create: {
            wineryId: 'winery-1',
            unsubscribeTokenExpiresAt: daysFromNow(WINERY_TOKEN_VALIDITY_DAYS),
          },
        })
      );
      expect(notificationPreferences.update).not.toHaveBeenCalled();
    });

    it('reuses a comfortably valid token without any write', async () => {
      const url = await getWineryUnsubscribeUrl(
        'winery-1',
        'weekly_summary',
        {
          unsubscribeToken: 'tok-live',
          unsubscribeTokenExpiresAt: daysFromNow(45),
        },
        NOW
      );

      expect(url).toBe(
        'https://test.encave.ch/api/unsubscribe/tok-live?type=weekly_summary'
      );
      expect(notificationPreferences.upsert).not.toHaveBeenCalled();
      expect(notificationPreferences.update).not.toHaveBeenCalled();
    });

    it('slides the expiry (same token) when the link would die within 30 days', async () => {
      const url = await getWineryUnsubscribeUrl(
        'winery-1',
        'daily_digest',
        {
          unsubscribeToken: 'tok-live',
          unsubscribeTokenExpiresAt: daysFromNow(10),
        },
        NOW
      );

      expect(url).toContain('/api/unsubscribe/tok-live?');
      expect(notificationPreferences.update).toHaveBeenCalledWith({
        where: { wineryId: 'winery-1' },
        data: {
          unsubscribeTokenExpiresAt: daysFromNow(WINERY_TOKEN_VALIDITY_DAYS),
        },
      });
    });

    it('rotates an expired token — the email must carry a working link', async () => {
      const url = await getWineryUnsubscribeUrl(
        'winery-1',
        'daily_digest',
        {
          unsubscribeToken: 'tok-dead',
          unsubscribeTokenExpiresAt: daysFromNow(-1),
        },
        NOW
      );

      const update = notificationPreferences.update.mock.calls[0]?.[0];
      expect(update.data.unsubscribeToken).toMatch(/^[0-9a-f]{64}$/);
      expect(update.data.unsubscribeTokenExpiresAt).toEqual(
        daysFromNow(WINERY_TOKEN_VALIDITY_DAYS)
      );
      expect(url).toBe(
        `https://test.encave.ch/api/unsubscribe/${update.data.unsubscribeToken}?type=daily_digest`
      );
      expect(url).not.toContain('tok-dead');
    });

    it('a legacy row without expiry stays valid, untouched', async () => {
      const url = await getWineryUnsubscribeUrl(
        'winery-1',
        'daily_digest',
        { unsubscribeToken: 'tok-legacy', unsubscribeTokenExpiresAt: null },
        NOW
      );

      expect(url).toContain('/api/unsubscribe/tok-legacy?');
      expect(notificationPreferences.update).not.toHaveBeenCalled();
    });
  });

  describe('applyWineryUnsubscribe (consumer)', () => {
    it('unknown token → invalid, nothing written', async () => {
      notificationPreferences.findUnique.mockResolvedValue(null);

      expect(await applyWineryUnsubscribe('nope', 'all', NOW)).toBe('invalid');
      expect(notificationPreferences.update).not.toHaveBeenCalled();
    });

    it('expired token → rotated, nobody unsubscribed', async () => {
      notificationPreferences.findUnique.mockResolvedValue({
        id: 'pref-1',
        unsubscribeTokenExpiresAt: daysFromNow(-2),
      });

      expect(await applyWineryUnsubscribe('old', 'all', NOW)).toBe('expired');
      const update = notificationPreferences.update.mock.calls[0]?.[0];
      expect(update.data).not.toHaveProperty('dailyDigest');
      expect(update.data.unsubscribeToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it.each([
      ['daily_digest', { dailyDigest: false }],
      ['weekly_summary', { weeklySummary: false }],
      ['marketing', { marketingEmails: false }],
      [
        'all',
        { dailyDigest: false, weeklySummary: false, marketingEmails: false },
      ],
    ] as const)(
      'scope %s switches off exactly its emails',
      async (type, data) => {
        notificationPreferences.findUnique.mockResolvedValue({
          id: 'pref-1',
          unsubscribeTokenExpiresAt: daysFromNow(20),
        });

        expect(await applyWineryUnsubscribe('tok', type, NOW)).toBe('success');
        expect(notificationPreferences.update).toHaveBeenCalledWith({
          where: { id: 'pref-1' },
          data,
        });
      }
    );
  });

  describe('client opt-out', () => {
    it('get-or-creates the row on the lower-cased email', async () => {
      clientEmailPreference.upsert.mockResolvedValue({
        marketingOptOut: false,
        unsubscribeToken: 'tok-client',
      });

      const result = await getClientUnsubscribe('Marc.Dupont@Example.COM');

      expect(clientEmailPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'marc.dupont@example.com' },
          create: { email: 'marc.dupont@example.com' },
        })
      );
      expect(result).toEqual({
        optedOut: false,
        unsubscribeUrl:
          'https://test.encave.ch/api/unsubscribe/client/tok-client',
      });
    });

    it('reports an opted-out client', async () => {
      clientEmailPreference.upsert.mockResolvedValue({
        marketingOptOut: true,
        unsubscribeToken: 'tok-client',
      });

      expect((await getClientUnsubscribe('a@b.ch')).optedOut).toBe(true);
    });

    it('applyClientUnsubscribe flips marketingOptOut; unknown token is refused', async () => {
      clientEmailPreference.findUnique.mockResolvedValueOnce(null);
      expect(await applyClientUnsubscribe('nope')).toEqual({ ok: false });
      expect(clientEmailPreference.update).not.toHaveBeenCalled();

      clientEmailPreference.findUnique.mockResolvedValueOnce({ id: 'cp-1' });
      expect(await applyClientUnsubscribe('tok')).toEqual({
        ok: true,
        preferenceId: 'cp-1',
      });
      expect(clientEmailPreference.update).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
        data: { marketingOptOut: true },
      });
    });
  });
});
