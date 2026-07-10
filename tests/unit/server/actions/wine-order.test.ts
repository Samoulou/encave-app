import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    experience: { findFirst: vi.fn() },
    wine: { count: vi.fn(), findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn() },
    wineOrderRequest: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
}));

vi.mock('@/server/services/rate-limit.service', () => ({
  WINE_ORDER_RATE_LIMIT: { maxRequests: 5, windowMs: 3_600_000 },
  getClientIp: vi.fn(() => '198.51.100.1'),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/server/services/email.service', () => ({
  sendWineOrderRequestEmails: vi.fn(async () => ({
    winery: true,
    client: true,
  })),
}));

vi.mock('@/server/services/email-log.service', () => ({
  logEmailSent: vi.fn(),
  logEmailFailed: vi.fn(),
  logEmailSkipped: vi.fn(),
}));

vi.mock('@/lib/posthog', () => ({
  getPostHogServer: vi.fn(() => null),
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.1' }),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { isFlagEnabled } =
  await import('@/server/queries/feature-flags.queries');
const { checkRateLimit } = await import('@/server/services/rate-limit.service');
const { sendWineOrderRequestEmails } =
  await import('@/server/services/email.service');
const { submitWineOrderRequest } =
  await import('@/server/actions/tasting-sheet');

const BOOKING_ID = 'cjld2cjxh0000qzrmn831i7rn';
const WINE_ID = 'cjld2cyuq0000t3rmniod1foy';
const TOKEN = 'a'.repeat(64);

const validInput = {
  bookingId: BOOKING_ID,
  token: TOKEN,
  items: [{ wineId: WINE_ID, quantity: 2 }],
};

const booking = {
  id: BOOKING_ID,
  reference: 'ENC-ABC12345',
  visitorName: 'Alice Test',
  visitorEmail: 'alice@test.ch',
  visitorPhone: '+41790000000',
  locale: 'FR',
  winery: {
    id: 'winery-1',
    name: 'Cave Test',
    email: 'cave@test.ch',
    user: { preferredLocale: 'FR' },
  },
  wines: [{ wineId: WINE_ID }],
};

const wine = {
  id: WINE_ID,
  name: 'Fendant',
  grapeVariety: 'Chasselas',
  vintage: 2024,
  price: 2450,
};

describe('submitWineOrderRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      remaining: 4,
      resetAt: Date.now() + 1000,
    } as never);
    vi.mocked(db.booking.findFirst).mockResolvedValue(booking as never);
    vi.mocked(db.wine.findMany).mockResolvedValue([wine] as never);
    vi.mocked(db.wineOrderRequest.create).mockResolvedValue({
      id: 'order-1',
    } as never);
  });

  it('rejects invalid input (empty items)', async () => {
    const result = await submitWineOrderRequest({
      ...validInput,
      items: [],
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('is rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 1000,
    } as never);
    const result = await submitWineOrderRequest(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'RATE_LIMITED' },
    });
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND when the flag is off (surface does not exist)', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const result = await submitWineOrderRequest(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND on a bad token (no existence leak)', async () => {
    vi.mocked(db.booking.findFirst).mockResolvedValue(null);
    const result = await submitWineOrderRequest(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(db.wineOrderRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a wine that was not served at this tasting', async () => {
    vi.mocked(db.booking.findFirst).mockResolvedValue({
      ...booking,
      wines: [],
    } as never);
    const result = await submitWineOrderRequest(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.wineOrderRequest.create).not.toHaveBeenCalled();
  });

  it('is CONFLICT when a request already exists (1-tap idempotence)', async () => {
    vi.mocked(db.wineOrderRequest.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '5.22.0',
      })
    );
    const result = await submitWineOrderRequest(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(sendWineOrderRequestEmails).not.toHaveBeenCalled();
  });

  it('creates the snapshotted request and emails the winery + the client', async () => {
    const result = await submitWineOrderRequest(validInput);
    expect(result).toEqual({
      success: true,
      data: { orderRequestId: 'order-1' },
    });
    expect(db.wineOrderRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: BOOKING_ID,
          wineryId: 'winery-1',
          clientEmail: 'alice@test.ch',
          items: {
            create: [
              expect.objectContaining({
                wineId: WINE_ID,
                wineName: 'Fendant',
                priceAtRequest: 2450,
                quantity: 2,
              }),
            ],
          },
        }),
      })
    );
    expect(sendWineOrderRequestEmails).toHaveBeenCalledWith(
      'cave@test.ch',
      expect.objectContaining({
        clientEmail: 'alice@test.ch',
        totalCents: 4900,
      }),
      'FR',
      'FR'
    );
  });
});
