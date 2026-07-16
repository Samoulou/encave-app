import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const queryRaw = vi.fn();
const stripeEventCount = vi.fn();
const scheduledJobCount = vi.fn();
vi.mock('@/server/db', () => ({
  db: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    stripeEvent: { count: (...args: unknown[]) => stripeEventCount(...args) },
    scheduledJob: {
      count: (...args: unknown[]) => scheduledJobCount(...args),
    },
  },
}));

const balanceRetrieve = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({ balance: { retrieve: balanceRetrieve } }),
}));

vi.mock('@/lib/env', () => ({
  env: {
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
  },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { GET } = await import('@/app/api/health/route');

function makeRequest(deep = false): NextRequest {
  return new NextRequest(
    `https://encave.ch/api/health${deep ? '?deep=1' : ''}`
  );
}

describe('/api/health (P-16 / WS-E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    balanceRetrieve.mockResolvedValue({ available: [] });
    stripeEventCount.mockResolvedValue(0);
    scheduledJobCount.mockResolvedValue(0);
  });

  it('shallow: 200 ok with db probe, redis skipped when unconfigured', async () => {
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.checks).toEqual({ db: 'ok', redis: 'skipped' });
    // Shallow never touches the paid probes.
    expect(balanceRetrieve).not.toHaveBeenCalled();
    expect(stripeEventCount).not.toHaveBeenCalled();
  });

  it('shallow: DB failure → 503 down (uptime monitor alerts on non-200)', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('down');
    expect(data.checks.db).toBe('fail');
    // No error details leak through the public endpoint.
    expect(JSON.stringify(data)).not.toContain('connection refused');
  });

  it('deep: 200 ok with stripe + stripeEvents + scheduledJobs probes', async () => {
    const response = await GET(makeRequest(true));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checks).toEqual({
      db: 'ok',
      redis: 'skipped',
      stripe: 'ok',
      stripeEvents: 'ok',
      scheduledJobs: 'ok',
    });
    // Stuck (PROCESSING) + recent FAILED are both counted.
    expect(stripeEventCount).toHaveBeenCalledTimes(2);
  });

  it('deep: stuck webhook events → 503 degraded', async () => {
    stripeEventCount.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    const response = await GET(makeRequest(true));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.stripeEvents).toBe('degraded');
  });

  it('deep: Stripe API unreachable → 503 down', async () => {
    balanceRetrieve.mockRejectedValue(new Error('stripe timeout'));
    const response = await GET(makeRequest(true));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('down');
    expect(data.checks.stripe).toBe('fail');
  });

  it('returns a valid ISO timestamp', async () => {
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });
});
