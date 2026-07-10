import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const verifyMock = vi.fn();
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({ verify: verifyMock })),
}));

vi.mock('@/lib/env', () => ({
  env: { RESEND_WEBHOOK_SECRET: 'whsec_test' },
}));

vi.mock('@/server/db', () => ({
  db: {
    emailLog: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { env } = await import('@/lib/env');
const { POST } = await import('@/app/api/webhooks/resend/route');

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('https://encave.ch/api/webhooks/resend', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'svix-id': 'msg_1',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,sig',
    },
  });
}

describe('POST /api/webhooks/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as { RESEND_WEBHOOK_SECRET?: string }).RESEND_WEBHOOK_SECRET =
      'whsec_test';
    vi.mocked(db.emailLog.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it('answers 503 when the secret is not configured', async () => {
    (env as { RESEND_WEBHOOK_SECRET?: string }).RESEND_WEBHOOK_SECRET =
      undefined;
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(503);
  });

  it('rejects an invalid signature with 401', async () => {
    verifyMock.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const response = await POST(makeRequest({ type: 'email.opened' }));
    expect(response.status).toBe(401);
    expect(db.emailLog.updateMany).not.toHaveBeenCalled();
  });

  it('records an open, first-wins', async () => {
    const event = {
      type: 'email.opened',
      created_at: '2026-07-10T10:00:00.000Z',
      data: { email_id: 'resend-msg-1' },
    };
    verifyMock.mockReturnValue(event);
    const response = await POST(makeRequest(event));
    expect(response.status).toBe(200);
    expect(db.emailLog.updateMany).toHaveBeenCalledWith({
      where: { resendMessageId: 'resend-msg-1', openedAt: null },
      data: { openedAt: new Date('2026-07-10T10:00:00.000Z') },
    });
  });

  it('records a click, first-wins', async () => {
    const event = {
      type: 'email.clicked',
      created_at: '2026-07-10T11:00:00.000Z',
      data: { email_id: 'resend-msg-2' },
    };
    verifyMock.mockReturnValue(event);
    const response = await POST(makeRequest(event));
    expect(response.status).toBe(200);
    expect(db.emailLog.updateMany).toHaveBeenCalledWith({
      where: { resendMessageId: 'resend-msg-2', clickedAt: null },
      data: { clickedAt: new Date('2026-07-10T11:00:00.000Z') },
    });
  });

  it('acknowledges unknown event types and missing ids without writing', async () => {
    verifyMock.mockReturnValue({ type: 'email.delivered', data: {} });
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(200);
    expect(db.emailLog.updateMany).not.toHaveBeenCalled();
  });
});
