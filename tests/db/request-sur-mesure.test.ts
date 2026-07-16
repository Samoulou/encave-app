/**
 * P-10 Request / sur-mesure — against a REAL migrated database.
 * Covers the webhook PAID flip idempotency (offer + request + job cancel)
 * and the auto-expiry closure, exercising the state machines and guarded
 * updateMany claims. Uses winery-less requests (wineryId is nullable) so no
 * winery/user graph needs seeding.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient, ScheduledJobStatus } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
}

// The expiry handler never sends email; the flip never does either — but the
// module graph pulls email.service in, so keep it inert & side-effect free.
vi.mock('@/server/services/email.service', () => ({
  sendRequestOfferExpiringEmail: vi.fn(async () => true),
  sendRequestSlaEscalationEmail: vi.fn(async () => true),
}));

const prisma = new PrismaClient();

const TAG = 'p10-db-test';
const createdRequestIds: string[] = [];
const createdOfferIds: string[] = [];

async function seedOfferedRequest(): Promise<{
  requestId: string;
  offerId: string;
}> {
  const request = await prisma.request.create({
    data: {
      reference: `REQ-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      status: 'OFFERED',
      clientName: TAG,
      clientEmail: `${TAG}@example.com`,
      guestCount: 6,
      description: 'db test request',
      locale: 'FR',
    },
    select: { id: true },
  });
  createdRequestIds.push(request.id);
  const offer = await prisma.requestOffer.create({
    data: {
      requestId: request.id,
      status: 'SENT',
      message: 'db test offer',
      totalPrice: 90000,
      scheduledDate: new Date('2026-09-01'),
      scheduledStartTime: '18:00',
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      paymentToken: `tok_${Math.random().toString(36).slice(2)}`,
    },
    select: { id: true },
  });
  createdOfferIds.push(offer.id);
  return { requestId: request.id, offerId: offer.id };
}

describe.skipIf(!url)('P-10 request flip + expiry (real DB)', () => {
  let flipRequestOfferPaid: (_id: string) => Promise<void>;
  let processRequestOfferExpiryJob: (
    _payload: unknown
  ) => Promise<{ ok: boolean }>;
  let dedupe: typeof import('@/lib/constants/request');

  beforeAll(async () => {
    ({ flipRequestOfferPaid } =
      await import('@/server/services/request.service'));
    ({ processRequestOfferExpiryJob } =
      await import('@/server/services/request-jobs.service'));
    dedupe = await import('@/lib/constants/request');
  });

  afterAll(async () => {
    await prisma.requestOffer.deleteMany({
      where: { request: { clientName: TAG } },
    });
    await prisma.scheduledJob.deleteMany({
      where: {
        dedupeKey: {
          in: createdOfferIds.flatMap((offerId) => [
            dedupe.requestOfferReminderDedupeKey(offerId),
            dedupe.requestOfferExpiryDedupeKey(offerId),
          ]),
        },
      },
    });
    await prisma.request.deleteMany({ where: { clientName: TAG } });
    await prisma.$disconnect();
  });

  it('flips offer + request to PAID and cancels the lifecycle jobs, idempotently', async () => {
    const { requestId, offerId } = await seedOfferedRequest();
    // Seed the lifecycle jobs under their CANONICAL dedupe keys — the flip
    // cancels by requestOffer{Reminder,Expiry}DedupeKey(offerId), a custom
    // test prefix would never match (bug found when this suite first ran in
    // CI, P-16 db-invariants job).
    const reminderKey = dedupe.requestOfferReminderDedupeKey(offerId);
    const expiryKey = dedupe.requestOfferExpiryDedupeKey(offerId);
    await prisma.scheduledJob.createMany({
      data: [
        {
          type: dedupe.REQUEST_OFFER_REMINDER_JOB_TYPE,
          runAt: new Date(),
          payload: { requestOfferId: offerId },
          dedupeKey: reminderKey,
          status: 'PENDING',
        },
        {
          type: dedupe.REQUEST_OFFER_EXPIRY_JOB_TYPE,
          runAt: new Date(),
          payload: { requestOfferId: offerId },
          dedupeKey: expiryKey,
          status: 'PENDING',
        },
      ],
    });

    await flipRequestOfferPaid(offerId);

    const offer = await prisma.requestOffer.findUnique({
      where: { id: offerId },
      select: { status: true },
    });
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { status: true },
    });
    const jobs = await prisma.scheduledJob.findMany({
      where: { dedupeKey: { in: [reminderKey, expiryKey] } },
      select: { status: true },
    });
    expect(jobs).toHaveLength(2);
    expect(offer?.status).toBe('PAID');
    expect(request?.status).toBe('PAID');
    expect(jobs.every((j) => j.status === ScheduledJobStatus.CANCELLED)).toBe(
      true
    );

    // Redelivery: second flip is a clean no-op.
    await flipRequestOfferPaid(offerId);
    const offerAgain = await prisma.requestOffer.findUnique({
      where: { id: offerId },
      select: { status: true },
    });
    expect(offerAgain?.status).toBe('PAID');

    await prisma.scheduledJob.deleteMany({
      where: { dedupeKey: { in: [reminderKey, expiryKey] } },
    });
  });

  it('auto-expires an unpaid offer and closes the request', async () => {
    const { requestId, offerId } = await seedOfferedRequest();

    const result = await processRequestOfferExpiryJob({
      requestOfferId: offerId,
    });
    expect(result.ok).toBe(true);

    const offer = await prisma.requestOffer.findUnique({
      where: { id: offerId },
      select: { status: true },
    });
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { status: true, closedAt: true },
    });
    expect(offer?.status).toBe('EXPIRED');
    expect(request?.status).toBe('EXPIRED');
    expect(request?.closedAt).not.toBeNull();
  });
});
