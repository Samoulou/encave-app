/**
 * Security regression for the cron gate (pre-launch audit, H4): the only
 * accepted proof is `Authorization: Bearer <CRON_SECRET>`. The former
 * `x-vercel-cron: 1` shortcut authenticated any client, and an unset
 * secret must fail closed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const CRON_SECRET = 'unit-cron-secret-0123456789abcdef';

// vi.mock factories are hoisted above the imports — shared mutable state
// must be created with vi.hoisted to exist when they run.
const { headerState, envState } = vi.hoisted(() => {
  const env: { CRON_SECRET: string | undefined } = { CRON_SECRET: undefined };
  return { headerState: { current: new Headers() }, envState: env };
});

vi.mock('next/headers', () => ({
  headers: async () => headerState.current,
}));

vi.mock('@/lib/env', () => ({
  env: envState,
}));

import { verifyCronRequest } from '@/lib/cron-auth';

function setHeaders(headers: Record<string, string> = {}): void {
  headerState.current = new Headers(headers);
}

describe('verifyCronRequest', () => {
  beforeEach(() => {
    envState.CRON_SECRET = CRON_SECRET;
    setHeaders();
  });

  it('accepts the exact Bearer CRON_SECRET', async () => {
    setHeaders({ authorization: `Bearer ${CRON_SECRET}` });
    expect(await verifyCronRequest()).toBe(true);
  });

  it('refuses a request without any auth header', async () => {
    expect(await verifyCronRequest()).toBe(false);
  });

  it('refuses the spoofable x-vercel-cron header on its own', async () => {
    setHeaders({ 'x-vercel-cron': '1' });
    expect(await verifyCronRequest()).toBe(false);
  });

  it('refuses a wrong secret, including same-length and prefix variants', async () => {
    setHeaders({ authorization: `Bearer ${'x'.repeat(CRON_SECRET.length)}` });
    expect(await verifyCronRequest()).toBe(false);

    setHeaders({ authorization: `Bearer ${CRON_SECRET.slice(0, -1)}` });
    expect(await verifyCronRequest()).toBe(false);

    setHeaders({ authorization: `Bearer ${CRON_SECRET}x` });
    expect(await verifyCronRequest()).toBe(false);
  });

  it('refuses the bare secret without the Bearer scheme', async () => {
    setHeaders({ authorization: CRON_SECRET });
    expect(await verifyCronRequest()).toBe(false);
  });

  it('fails closed when CRON_SECRET is not configured', async () => {
    envState.CRON_SECRET = undefined;
    setHeaders({ authorization: 'Bearer undefined' });
    expect(await verifyCronRequest()).toBe(false);

    setHeaders({ authorization: 'Bearer ' });
    expect(await verifyCronRequest()).toBe(false);

    setHeaders({ 'x-vercel-cron': '1' });
    expect(await verifyCronRequest()).toBe(false);
  });
});
