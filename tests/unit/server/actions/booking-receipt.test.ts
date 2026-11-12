import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '203.0.113.9' })),
}));

vi.mock('@/server/db', () => ({
  db: { booking: { findUnique: vi.fn() } },
}));

vi.mock('@/server/services/rate-limit.service', () => ({
  API_RATE_LIMIT: { maxRequests: 60, windowMs: 60_000 },
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '203.0.113.9'),
}));

vi.mock('@/server/services/booking-receipt.service', () => ({
  generateBookingReceiptPDF: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { checkRateLimit } = await import('@/server/services/rate-limit.service');
const { generateBookingReceiptPDF } =
  await import('@/server/services/booking-receipt.service');
const { exportBookingReceiptPDF } =
  await import('@/server/actions/booking-receipt');

const booking = {
  id: 'booking-1',
  reference: 'ENC-RECEIPT1',
  visitorName: 'Alice Test',
  visitorEmail: 'alice@test.ch',
  stripeCheckoutSessionId: 'cs_test_owner',
  status: BookingStatus.CONFIRMED,
  date: new Date('2026-12-05T00:00:00.000Z'),
  timeSlot: '14:00',
  guestCount: 2,
  totalPrice: 9000,
  serviceFeeCents: 500,
  locale: 'DE',
  experience: { title: 'Dégustation', duration: 90 },
  winery: { name: 'Cave Test', address: 'Rue 1', commune: 'Sion' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({
    success: true,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  } as never);
  vi.mocked(db.booking.findUnique).mockResolvedValue(booking as never);
  vi.mocked(generateBookingReceiptPDF).mockResolvedValue(
    Buffer.from('%PDF-receipt') as never
  );
});

/**
 * Guest-facing action: there is no session — the Stripe checkout session
 * id returned to the payer IS the proof of ownership.
 */
describe('exportBookingReceiptPDF', () => {
  it.each([
    ['no checkout session id', 'booking-1', null],
    ['an empty checkout session id', 'booking-1', ''],
    ['an empty booking id', '', 'cs_test_owner'],
  ])('refuses %s (UNAUTHORIZED) without any read', async (_, id, sessionId) => {
    const result = await exportBookingReceiptPDF(id, sessionId);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(db.booking.findUnique).not.toHaveBeenCalled();
  });

  it('is rate-limited per IP before the booking is read', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    } as never);

    const result = await exportBookingReceiptPDF('booking-1', 'cs_test_owner');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'RATE_LIMITED' },
    });
    expect(checkRateLimit).toHaveBeenCalledWith(
      'receipt:203.0.113.9',
      expect.anything()
    );
    expect(db.booking.findUnique).not.toHaveBeenCalled();
  });

  it("refuses another payer's checkout session (NOT_FOUND, no PDF)", async () => {
    const result = await exportBookingReceiptPDF('booking-1', 'cs_test_other');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(generateBookingReceiptPDF).not.toHaveBeenCalled();
  });

  it.each([
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CANCELLED_BY_CLIENT,
    BookingStatus.CANCELLED_BY_WINERY,
  ])('issues no receipt for a %s booking', async (status) => {
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...booking,
      status,
    } as never);

    const result = await exportBookingReceiptPDF('booking-1', 'cs_test_owner');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(generateBookingReceiptPDF).not.toHaveBeenCalled();
  });

  it('unknown booking → NOT_FOUND', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(null);

    const result = await exportBookingReceiptPDF('missing', 'cs_test_owner');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it("returns the PDF in the booking's own locale", async () => {
    const result = await exportBookingReceiptPDF('booking-1', 'cs_test_owner');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Buffer.from(result.data.pdf, 'base64').toString()).toBe(
      '%PDF-receipt'
    );
    expect(result.data.filename).toMatch(
      /^encave-receipt-ENC-RECEIPT1-\d{4}-\d{2}-\d{2}\.pdf$/
    );
    expect(generateBookingReceiptPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'ENC-RECEIPT1',
        guestCount: 2,
        totalPrice: 9000,
        serviceFeeCents: 500,
        wineryCommune: 'Sion',
      }),
      'de'
    );
  });

  it('never throws: a rendering failure becomes INTERNAL_ERROR', async () => {
    vi.mocked(generateBookingReceiptPDF).mockRejectedValue(new Error('boom'));

    const result = await exportBookingReceiptPDF('booking-1', 'cs_test_owner');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
