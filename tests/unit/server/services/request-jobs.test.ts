import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { ADMIN_ALERT_EMAIL: 'sam@encave.ch' },
  getBaseUrl: () => 'https://encave.ch',
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));
vi.mock('@/server/services/email.service', () => ({
  sendRequestOfferExpiringEmail: vi.fn(async () => true),
  sendRequestSlaEscalationEmail: vi.fn(async () => true),
}));
vi.mock('@/server/db', () => {
  const db = {
    requestOffer: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    request: { findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db };
});

const { db } = await import('@/server/db');
const { env } = await import('@/lib/env');
const emailService = await import('@/server/services/email.service');
const {
  processRequestOfferReminderJob,
  processRequestOfferExpiryJob,
  processRequestSlaEscalationJob,
} = await import('@/server/services/request-jobs.service');

beforeEach(() => {
  vi.clearAllMocks();
  env.ADMIN_ALERT_EMAIL = 'sam@encave.ch';
  vi.mocked(db.$transaction).mockImplementation((arg: unknown) =>
    Promise.all(arg as Promise<unknown>[])
  );
});

function sentOffer(over: Record<string, unknown> = {}) {
  return {
    id: 'offer-1',
    status: 'SENT',
    totalPrice: 120000,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    reminderSentAt: null,
    paymentToken: 'tok123',
    request: {
      clientEmail: 'jean@example.com',
      clientName: 'Jean',
      locale: 'FR',
      winery: { name: 'Domaine Test' },
    },
    ...over,
  };
}

describe('processRequestOfferReminderJob (#10)', () => {
  it('skips an invalid payload', async () => {
    const r = await processRequestOfferReminderJob({});
    expect(r).toEqual({ ok: false, skipReason: 'invalid_payload' });
  });

  it('is a no-op if already reminded', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(
      sentOffer({ reminderSentAt: new Date() }) as never
    );
    const r = await processRequestOfferReminderJob({
      requestOfferId: 'offer-1',
    });
    expect(r).toEqual({ ok: true, note: 'already_reminded' });
    expect(emailService.sendRequestOfferExpiringEmail).not.toHaveBeenCalled();
  });

  it('skips a non-SENT offer', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(
      sentOffer({ status: 'PAID' }) as never
    );
    const r = await processRequestOfferReminderJob({
      requestOfferId: 'offer-1',
    });
    expect(r).toEqual({ ok: false, skipReason: 'status_paid' });
  });

  it('skips an already-expired offer', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(
      sentOffer({ expiresAt: new Date(Date.now() - 1000) }) as never
    );
    const r = await processRequestOfferReminderJob({
      requestOfferId: 'offer-1',
    });
    expect(r).toEqual({ ok: false, skipReason: 'already_expired' });
  });

  it('sends #10 and stamps reminderSentAt (happy path)', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(
      sentOffer() as never
    );
    const r = await processRequestOfferReminderJob({
      requestOfferId: 'offer-1',
    });
    expect(r).toEqual({ ok: true });
    expect(emailService.sendRequestOfferExpiringEmail).toHaveBeenCalledTimes(1);
    expect(db.requestOffer.update).toHaveBeenCalledWith({
      where: { id: 'offer-1' },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it('throws when the email send fails (so the runner retries)', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(
      sentOffer() as never
    );
    vi.mocked(emailService.sendRequestOfferExpiringEmail).mockResolvedValue(
      false
    );
    await expect(
      processRequestOfferReminderJob({ requestOfferId: 'offer-1' })
    ).rejects.toThrow();
  });
});

describe('processRequestOfferExpiryJob', () => {
  it('expires a SENT offer and its request', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue({
      id: 'offer-1',
      status: 'SENT',
      requestId: 'req-1',
    } as never);
    const r = await processRequestOfferExpiryJob({ requestOfferId: 'offer-1' });
    expect(r).toEqual({ ok: true });
    expect(db.requestOffer.updateMany).toHaveBeenCalledWith({
      where: { id: 'offer-1', status: 'SENT' },
      data: { status: 'EXPIRED' },
    });
    expect(db.request.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'OFFERED' },
      data: { status: 'EXPIRED', closedAt: expect.any(Date) },
    });
  });

  it('is a no-op for an already-paid offer', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue({
      id: 'offer-1',
      status: 'PAID',
      requestId: 'req-1',
    } as never);
    const r = await processRequestOfferExpiryJob({ requestOfferId: 'offer-1' });
    expect(r).toEqual({ ok: true, note: 'already_paid' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('skips a withdrawn offer', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue({
      id: 'offer-1',
      status: 'WITHDRAWN',
      requestId: 'req-1',
    } as never);
    const r = await processRequestOfferExpiryJob({ requestOfferId: 'offer-1' });
    expect(r).toEqual({ ok: false, skipReason: 'status_withdrawn' });
  });
});

describe('processRequestSlaEscalationJob', () => {
  function pendingRequest() {
    return {
      id: 'req-1',
      reference: 'REQ-TEST1234',
      status: 'PENDING',
      clientName: 'Jean',
      clientEmail: 'jean@example.com',
      guestCount: 12,
      createdAt: new Date('2026-07-11T10:00:00Z'),
      winery: { name: 'Domaine Test' },
    };
  }

  it('skips a request that has been answered', async () => {
    vi.mocked(db.request.findUnique).mockResolvedValue({
      ...pendingRequest(),
      status: 'OFFERED',
    } as never);
    const r = await processRequestSlaEscalationJob({ requestId: 'req-1' });
    expect(r).toEqual({ ok: false, skipReason: 'answered_or_closed' });
    expect(emailService.sendRequestSlaEscalationEmail).not.toHaveBeenCalled();
  });

  it('skips cleanly when ADMIN_ALERT_EMAIL is unset', async () => {
    env.ADMIN_ALERT_EMAIL = undefined;
    vi.mocked(db.request.findUnique).mockResolvedValue(
      pendingRequest() as never
    );
    const r = await processRequestSlaEscalationJob({ requestId: 'req-1' });
    expect(r).toEqual({ ok: false, skipReason: 'no_admin_email' });
  });

  it('emails Sam for a still-pending request (happy path)', async () => {
    vi.mocked(db.request.findUnique).mockResolvedValue(
      pendingRequest() as never
    );
    const r = await processRequestSlaEscalationJob({ requestId: 'req-1' });
    expect(r).toEqual({ ok: true });
    expect(emailService.sendRequestSlaEscalationEmail).toHaveBeenCalledTimes(1);
  });
});
