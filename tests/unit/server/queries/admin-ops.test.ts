import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    stripeEvent: { findMany: vi.fn() },
    emailLog: { findMany: vi.fn(), count: vi.fn() },
    scheduledJob: { findMany: vi.fn() },
  },
}));

import { db } from '@/server/db';
import {
  getWebhookHealth,
  getRecentIncidents,
} from '@/server/queries/admin-ops.queries';

const mockDb = vi.mocked(db);
const NOW = new Date('2026-07-15T12:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getWebhookHealth', () => {
  it('counts failed/stuck/processed and computes lag', async () => {
    const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
    mockDb.stripeEvent.findMany.mockResolvedValue([
      // most recent → lastEventAt; PROCESSED with 1s lag
      {
        status: 'PROCESSED',
        createdAt: minutesAgo(1),
        updatedAt: new Date(minutesAgo(1).getTime() + 1000),
      },
      // stuck: PROCESSING for 20 min (> 15 min threshold)
      {
        status: 'PROCESSING',
        createdAt: minutesAgo(20),
        updatedAt: minutesAgo(20),
      },
      // fresh PROCESSING (5 min) → not stuck
      {
        status: 'PROCESSING',
        createdAt: minutesAgo(5),
        updatedAt: minutesAgo(5),
      },
      {
        status: 'FAILED',
        createdAt: minutesAgo(30),
        updatedAt: minutesAgo(30),
      },
    ] as never);

    const health = await getWebhookHealth();

    expect(health.failedCount).toBe(1);
    expect(health.stuckCount).toBe(1);
    expect(health.processedCount).toBe(1);
    expect(health.maxLagMs).toBe(1000);
    expect(health.avgLagMs).toBe(1000);
    expect(health.lastEventAt).toBe(minutesAgo(1).toISOString());
  });
});

describe('getRecentIncidents', () => {
  it('maps failed emails + jobs to ISO-dated DTOs', async () => {
    const created = new Date('2026-07-15T11:00:00.000Z');
    mockDb.emailLog.findMany.mockResolvedValue([
      {
        id: 'e1',
        type: 'reminder_24h',
        createdAt: created,
        errorMessage: 'bounce',
      },
    ] as never);
    mockDb.emailLog.count.mockResolvedValue(4);
    mockDb.scheduledJob.findMany.mockResolvedValue([
      {
        id: 'j1',
        type: 'TASTING_RECAP',
        runAt: created,
        attempts: 3,
        lastError: 'timeout',
      },
    ] as never);

    const incidents = await getRecentIncidents();

    expect(incidents.failedEmails24h).toBe(4);
    expect(incidents.failedEmails[0]).toEqual({
      id: 'e1',
      type: 'reminder_24h',
      createdAt: created.toISOString(),
      errorMessage: 'bounce',
    });
    expect(incidents.failedJobs[0]).toEqual({
      id: 'j1',
      type: 'TASTING_RECAP',
      runAt: created.toISOString(),
      attempts: 3,
      lastError: 'timeout',
    });
  });
});
