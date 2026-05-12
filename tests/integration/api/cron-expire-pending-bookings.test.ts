import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus } from '@prisma/client';

/**
 * ENC-067 — Cron expiration intégration test.
 *
 * Vérifie le contrat HTTP du endpoint :
 *   - 401 sans CRON_SECRET valide (Vercel header `x-vercel-cron` OR
 *     `Authorization: Bearer $CRON_SECRET`)
 *   - 200 avec count des bookings flippés `PENDING_PAYMENT` → `CANCELLED_BY_CLIENT`
 *   - bookings < 30 min non touchés
 *   - bookings > 30 min flippés et leur capacité libérée via `revalidateTag`
 *   - bookings déjà CONFIRMED ignorés (idempotence du filtre `where: status: PENDING_PAYMENT`)
 *
 * On mock la DB (Prisma) + `next/cache` + `next/headers` + `env`. Pas de
 * vraie connexion Postgres ici — c'est un test de **contrat** du route
 * handler, pas un test bout-en-bout DB. Pour la couverture DB réelle, voir
 * `tests/integration/actions/booking.test.ts` qui exécute contre Docker.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    CRON_SECRET: 'test-cron-secret-xyz',
  },
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { headers } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { db } from '@/server/db';

const { GET } = await import('@/app/api/cron/expire-pending-bookings/route');

const mockHeaders = vi.mocked(headers);
const mockRevalidateTag = vi.mocked(revalidateTag);
const mockDb = vi.mocked(db);

function withHeaders(values: Record<string, string>) {
  const map = new Map(Object.entries(values));
  return {
    get: (name: string) => map.get(name.toLowerCase()) ?? null,
  };
}

describe('GET /api/cron/expire-pending-bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auth', () => {
    it('returns 401 without CRON_SECRET or vercel-cron header', async () => {
      mockHeaders.mockResolvedValue(withHeaders({}) as never);

      const response = await GET();

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('Unauthorized');
      expect(mockDb.booking.findMany).not.toHaveBeenCalled();
      expect(mockDb.booking.updateMany).not.toHaveBeenCalled();
    });

    it('returns 401 with wrong bearer token', async () => {
      mockHeaders.mockResolvedValue(
        withHeaders({ authorization: 'Bearer wrong-secret' }) as never
      );

      const response = await GET();

      expect(response.status).toBe(401);
    });

    it('authorizes via valid Authorization header', async () => {
      mockHeaders.mockResolvedValue(
        withHeaders({
          authorization: 'Bearer test-cron-secret-xyz',
        }) as never
      );
      mockDb.booking.findMany.mockResolvedValue([]);

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.expired).toBe(0);
    });

    it('authorizes via x-vercel-cron=1 header (Vercel runtime)', async () => {
      mockHeaders.mockResolvedValue(
        withHeaders({ 'x-vercel-cron': '1' }) as never
      );
      mockDb.booking.findMany.mockResolvedValue([]);

      const response = await GET();

      expect(response.status).toBe(200);
    });
  });

  describe('expiration logic', () => {
    beforeEach(() => {
      mockHeaders.mockResolvedValue(
        withHeaders({ 'x-vercel-cron': '1' }) as never
      );
    });

    it('returns expired: 0 when no PENDING_PAYMENT older than 30 min exists', async () => {
      mockDb.booking.findMany.mockResolvedValue([]);

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.expired).toBe(0);
      expect(mockDb.booking.updateMany).not.toHaveBeenCalled();
      expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    it('flips PENDING_PAYMENT > 30min to CANCELLED_BY_CLIENT and reports the count', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          reference: 'ENC-AAA111',
          experience: { slug: 'wine-tasting-test' },
        },
        {
          id: 'b2',
          reference: 'ENC-BBB222',
          experience: { slug: 'wine-tasting-test' },
        },
        {
          id: 'b3',
          reference: 'ENC-CCC333',
          experience: { slug: 'cellar-tour-test' },
        },
      ] as never);
      mockDb.booking.updateMany.mockResolvedValue({ count: 3 } as never);

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.expired).toBe(3);
      expect(json.durationMs).toBeGreaterThanOrEqual(0);

      // Verify the update used the correct filter and target status.
      expect(mockDb.booking.updateMany).toHaveBeenCalledWith({
        where: {
          status: BookingStatus.PENDING_PAYMENT,
          createdAt: { lt: expect.any(Date) },
        },
        data: {
          status: BookingStatus.CANCELLED_BY_CLIENT,
          cancelledAt: expect.any(Date),
        },
      });

      // Cache invalidation is deduplicated by slug (2 distinct slugs).
      expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'experience:wine-tasting-test:availability'
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith(
        'experience:cellar-tour-test:availability'
      );
    });

    it('uses a cutoff of 30 minutes in the past', async () => {
      mockDb.booking.findMany.mockResolvedValue([]);

      const before = Date.now();
      await GET();
      const after = Date.now();

      const call = mockDb.booking.findMany.mock.calls[0]?.[0];
      const cutoff = (call?.where?.createdAt as { lt: Date } | undefined)?.lt;

      expect(cutoff).toBeInstanceOf(Date);
      const cutoffMs = cutoff!.getTime();
      // cutoff = now - 30 min, with some tolerance for the call duration.
      expect(cutoffMs).toBeGreaterThanOrEqual(before - 30 * 60 * 1000 - 5);
      expect(cutoffMs).toBeLessThanOrEqual(after - 30 * 60 * 1000 + 5);
    });

    it('does not target bookings that have moved out of PENDING_PAYMENT (idempotent filter)', async () => {
      // The cron filters strictly on `status: PENDING_PAYMENT`. Bookings
      // already CONFIRMED or CANCELLED_* never appear in `findMany` results
      // and updateMany will not touch them — we simulate that here.
      mockDb.booking.findMany.mockResolvedValue([]);

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.expired).toBe(0);

      // The query MUST filter on PENDING_PAYMENT.
      const findCall = mockDb.booking.findMany.mock.calls[0]?.[0];
      expect(findCall?.where?.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('returns 500 on DB error and logs it', async () => {
      mockDb.booking.findMany.mockRejectedValue(new Error('DB down'));

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
