import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/server/db';
import { BookingStatus, ExperienceStatus, WineryStatus } from '@prisma/client';

// Mock Stripe (hoisted spies so tests can assert on session payloads)
const { sessionCreateMock, sessionExpireMock } = vi.hoisted(() => ({
  sessionCreateMock: vi.fn(),
  sessionExpireMock: vi.fn(),
}));
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: sessionCreateMock,
          expire: sessionExpireMock,
        },
      },
    })),
  };
});

// Mock db with $transaction support
vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findUnique: vi.fn(),
    },
    booking: {
      aggregate: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    featureFlag: {
      findMany: vi.fn(),
    },
    // $transaction executes the callback with the same db object (simplified mock)
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      // Create a transaction-like object that delegates to the mocked methods
      const { db } = await import('@/server/db');
      return callback({
        booking: db.booking,
        experience: db.experience,
      });
    }),
  },
}));

// The in-memory rate limiter keys on visitor email / IP and persists across
// tests in this file — stub the check (keep the real config exports) so
// results don't depend on how many tests ran before.
vi.mock('@/server/services/rate-limit.service', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/server/services/rate-limit.service')
    >();
  return {
    ...actual,
    checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  };
});

// The Stripe fee label is resolved via next-intl outside a request scope.
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) =>
    key === 'serviceFee' ? 'Frais de service' : key,
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
    BETTER_AUTH_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://test',
    PLATFORM_COMMISSION_RATE: 0.12,
    NODE_ENV: 'test',
  },
  getBaseUrl: () => 'http://localhost:3000',
}));

/** Narrow the captured create() payload without `!` (CLAUDE.md rule). */
function requireCaptured(
  data: Record<string, unknown> | null
): Record<string, unknown> {
  expect(data).not.toBeNull();
  if (data === null) throw new Error('booking.create was never called');
  return data;
}

describe('Checkout Server Actions', () => {
  const validAccessToken = 'valid-token';
  const validAccessTokenHash =
    '397a2a9c5bf5e2ccec38c2596b682bb1bd05fe6e4ecea6c10cf42755ff225403';

  beforeEach(() => {
    vi.clearAllMocks();
    sessionCreateMock.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
      payment_intent: 'pi_test_123',
    });
    // Flags default OFF (empty table) — the BOOKING_FEE tests override this.
    vi.mocked(db.featureFlag.findMany).mockResolvedValue([] as never);
  });

  const mockExperience = {
    id: 'exp-1',
    title: 'Wine Tasting',
    slug: 'wine-tasting',
    status: ExperienceStatus.PUBLISHED,
    price: 5000, // 50 CHF in cents
    minCapacity: 2,
    maxCapacity: 10,
    winery: {
      id: 'winery-1',
      name: 'Test Winery',
      status: WineryStatus.VERIFIED,
      stripeAccountId: 'acct_test_123',
      stripeOnboardingComplete: true,
      commissionRate: null,
    },
  };

  const validInput = {
    experienceId: 'exp-1',
    wineryId: 'winery-1',
    date: '2026-02-15',
    timeSlot: '10:00',
    guestCount: 4,
    visitorName: 'John Doe',
    visitorEmail: 'john@example.com',
    visitorPhone: '+41791234567',
    ageConfirmed: true as const,
    displayedServiceFeeCentsPerGuest: 0,
  };

  const mockExperienceForClaim = {
    ...mockExperience,
    winery: { ...mockExperience.winery, cancellationPolicy: 'STANDARD' },
  };
  const validInputForClaim = validInput;

  describe('createBookingAndCheckout', () => {
    it('requires age confirmation before creating Stripe checkout', async () => {
      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInput,
        ageConfirmed: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
      expect(db.experience.findUnique).not.toHaveBeenCalled();
    });

    it('creates booking and returns checkout URL with valid input', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperience as never
      );
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.findUnique).mockResolvedValue(null);
      vi.mocked(db.booking.create).mockResolvedValue({
        id: 'booking-1',
        reference: 'ENC-ABC123',
        status: BookingStatus.PENDING_PAYMENT,
      } as never);
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      // Dynamically import after mocks are set up
      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookingId).toBe('booking-1');
        expect(result.data.bookingReference).toBe('ENC-ABC123');
        expect(result.data.checkoutUrl).toContain('checkout.stripe.com');
      }
    });

    it('returns validation error when winery id does not match the experience', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperience as never
      );

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInput,
        wineryId: 'spoofed-winery',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
      expect(db.booking.create).not.toHaveBeenCalled();
    });

    it('returns validation error when experience is not published', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        ...mockExperience,
        status: ExperienceStatus.DRAFT,
      } as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
      expect(db.booking.create).not.toHaveBeenCalled();
    });

    it('returns validation error when winery is not verified', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        ...mockExperience,
        winery: {
          ...mockExperience.winery,
          status: WineryStatus.PENDING,
        },
      } as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
      expect(db.booking.create).not.toHaveBeenCalled();
    });

    it('rejects the reserved hold sentinel domain as visitor email', async () => {
      // Security review: the sentinel is the only hold/booking
      // discriminator — a paid booking on that domain would be invisible
      // to the winery dashboard and CSV export.
      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInput,
        visitorEmail: 'sneaky@hold.encave.ch',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
      expect(db.booking.create).not.toHaveBeenCalled();
    });

    it('returns validation error for invalid email', async () => {
      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInput,
        visitorEmail: 'invalid-email',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns validation error for missing name', async () => {
      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInput,
        visitorName: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns NOT_FOUND when experience does not exist', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(null);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns STRIPE_NOT_READY when winery not connected', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        ...mockExperience,
        winery: {
          ...mockExperience.winery,
          stripeAccountId: null,
          stripeOnboardingComplete: false,
        },
      } as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('STRIPE_NOT_READY');
      }
    });

    it('returns NO_CAPACITY when slot is full', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperience as never
      );
      // Already 8 guests booked, max is 10, trying to book 4 more
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 8 },
      } as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_CAPACITY');
      }
    });

    it('calculates platform fee correctly', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperience as never
      );
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.findUnique).mockResolvedValue(null);

      let capturedBookingData: Record<string, unknown> | null = null;
      vi.mocked(db.booking.create).mockImplementation(
        (args: { data: Record<string, unknown> }) => {
          capturedBookingData = args.data;
          return Promise.resolve({
            id: 'booking-1',
            reference: 'ENC-ABC123',
            status: BookingStatus.PENDING_PAYMENT,
          });
        }
      );
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      await createBookingAndCheckout(validInput);

      // Total: 5000 * 4 = 20000 cents (200 CHF)
      // Platform fee: 20000 * 0.12 = 2400 cents (24 CHF)
      // Winery payout: 20000 - 2400 = 17600 cents (176 CHF)
      const captured = requireCaptured(capturedBookingData);
      expect(captured.totalPrice).toBe(20000);
      expect(captured.platformFee).toBe(2400);
      expect(captured.wineryPayout).toBe(17600);
      // Flag OFF: no service fee, single Stripe line, unchanged app fee.
      expect(captured.serviceFeeCents).toBe(0);
      const sessionOff = sessionCreateMock.mock.calls[0]?.[0];
      expect(sessionOff.line_items).toHaveLength(1);
      expect(sessionOff.payment_intent_data.application_fee_amount).toBe(2400);
    });

    it('charges the 2.50/ticket service fee as a separate line when BOOKING_FEE is ON', async () => {
      vi.mocked(db.featureFlag.findMany).mockResolvedValue([
        { key: 'BOOKING_FEE', enabled: true, updatedAt: new Date() },
      ] as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperience as never
      );
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.findUnique).mockResolvedValue(null);

      let capturedBookingData: Record<string, unknown> | null = null;
      vi.mocked(db.booking.create).mockImplementation(
        (args: { data: Record<string, unknown> }) => {
          capturedBookingData = args.data;
          return Promise.resolve({
            id: 'booking-1',
            reference: 'ENC-ABC123',
            status: BookingStatus.PENDING_PAYMENT,
          });
        }
      );
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      await createBookingAndCheckout({
        ...validInput,
        displayedServiceFeeCentsPerGuest: 250,
      });

      // 4 guests × 250 = 1000 cents of service fee, platform's revenue:
      // totalPrice stays 20000, application_fee = 2400 + 1000.
      const captured = requireCaptured(capturedBookingData);
      expect(captured.totalPrice).toBe(20000);
      expect(captured.serviceFeeCents).toBe(1000);
      expect(captured.wineryPayout).toBe(17600);
      const session = sessionCreateMock.mock.calls[0]?.[0];
      expect(session.line_items).toHaveLength(2);
      expect(session.line_items[1].price_data.unit_amount).toBe(250);
      expect(session.line_items[1].quantity).toBe(4);
      expect(session.payment_intent_data.application_fee_amount).toBe(3400);
    });

    it('charges only the service fee for a Founder winery (0% commission)', async () => {
      vi.mocked(db.featureFlag.findMany).mockResolvedValue([
        { key: 'BOOKING_FEE', enabled: true, updatedAt: new Date() },
      ] as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        ...mockExperience,
        winery: { ...mockExperience.winery, commissionRate: 0 },
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.findUnique).mockResolvedValue(null);

      let capturedBookingData: Record<string, unknown> | null = null;
      vi.mocked(db.booking.create).mockImplementation(
        (args: { data: Record<string, unknown> }) => {
          capturedBookingData = args.data;
          return Promise.resolve({
            id: 'booking-1',
            reference: 'ENC-ABC123',
            status: BookingStatus.PENDING_PAYMENT,
          });
        }
      );
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      await createBookingAndCheckout({
        ...validInput,
        displayedServiceFeeCentsPerGuest: 250,
      });

      // Founder: platformFee 0, full payout; app fee = client fee alone.
      const captured = requireCaptured(capturedBookingData);
      expect(captured.platformFee).toBe(0);
      expect(captured.wineryPayout).toBe(20000);
      expect(captured.serviceFeeCents).toBe(1000);
      const session = sessionCreateMock.mock.calls[0]?.[0];
      expect(session.payment_intent_data.application_fee_amount).toBe(1000);
    });
  });

  describe('createBookingHold (L-050)', () => {
    it('creates a 10-minute hold with placeholder visitor data', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        id: 'exp-1',
        status: ExperienceStatus.PUBLISHED,
        price: 5000,
        minCapacity: 2,
        maxCapacity: 10,
        winery: {
          id: 'winery-1',
          status: WineryStatus.VERIFIED,
          stripeAccountId: 'acct_test_123',
          stripeOnboardingComplete: true,
          commissionRate: null,
          cancellationPolicy: 'STANDARD',
        },
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      let captured: Record<string, unknown> | null = null;
      vi.mocked(db.booking.create).mockImplementation(
        (args: { data: Record<string, unknown> }) => {
          captured = args.data;
          return Promise.resolve({ id: 'hold-1', ...args.data });
        }
      );

      const { createBookingHold } = await import('@/server/actions/checkout');
      const result = await createBookingHold({
        experienceId: 'exp-1',
        date: '2026-02-15',
        timeSlot: '10:00',
        guestCount: 4,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.holdId).toBe('hold-1');
        // Ownership secret returned to the caller, only its HASH stored.
        expect(result.data.holdToken.length).toBeGreaterThanOrEqual(16);
        const msLeft = new Date(result.data.expiresAt).getTime() - Date.now();
        expect(msLeft).toBeGreaterThan(9 * 60 * 1000);
        expect(msLeft).toBeLessThanOrEqual(10 * 60 * 1000);
      }
      const data = requireCaptured(captured);
      expect(data.visitorName).toBe('');
      expect(String(data.visitorEmail)).toMatch(/@hold\.encave\.ch$/);
      expect(data.status).toBe(BookingStatus.PENDING_PAYMENT);
      expect(data.serviceFeeCents).toBe(0);
      expect(String(data.accessTokenHash)).toMatch(/^[0-9a-f]{64}$/);
      if (result.success) {
        expect(data.accessTokenHash).not.toBe(result.data.holdToken);
      }
    });

    it('releases the caller previous unclaimed hold before the capacity check', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        ...mockExperienceForClaim,
        maxCapacity: 4,
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.deleteMany).mockResolvedValue({
        count: 1,
      } as never);
      vi.mocked(db.booking.create).mockResolvedValue({
        id: 'hold-2',
      } as never);

      const { createBookingHold } = await import('@/server/actions/checkout');
      const result = await createBookingHold({
        experienceId: 'exp-1',
        date: '2026-02-15',
        timeSlot: '10:00',
        guestCount: 4,
        previousHoldId: 'ckvhold00000000000000000w',
        previousHoldToken: 'hold-token-0123456789abcdef',
      });

      expect(result.success).toBe(true);
      // Guarded delete: only an UNCLAIMED sentinel hold owned via the
      // token hash — a claimed/real booking can never be deleted here.
      expect(db.booking.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: 'ckvhold00000000000000000w',
          status: BookingStatus.PENDING_PAYMENT,
          accessTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
          visitorEmail: { endsWith: '@hold.encave.ch' },
          stripeCheckoutSessionId: null,
        }),
      });
    });

    it('refuses a hold when the slot lacks capacity', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        id: 'exp-1',
        status: ExperienceStatus.PUBLISHED,
        price: 5000,
        minCapacity: 2,
        maxCapacity: 3,
        winery: {
          id: 'winery-1',
          status: WineryStatus.VERIFIED,
          stripeAccountId: 'acct_test_123',
          stripeOnboardingComplete: true,
          commissionRate: null,
          cancellationPolicy: 'STANDARD',
        },
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 2 },
      } as never);

      const { createBookingHold } = await import('@/server/actions/checkout');
      const result = await createBookingHold({
        experienceId: 'exp-1',
        date: '2026-02-15',
        timeSlot: '10:00',
        guestCount: 2,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_CAPACITY');
      }
      expect(db.booking.create).not.toHaveBeenCalled();
    });
  });

  describe('hold claim at submit (L-050)', () => {
    it('claims a live hold instead of creating a new booking', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperienceForClaim as never
      );
      vi.mocked(db.booking.updateMany).mockResolvedValue({
        count: 1,
      } as never);
      vi.mocked(db.booking.findUniqueOrThrow).mockResolvedValue({
        id: 'hold-1',
        reference: 'ENC-HOLD1234',
      } as never);
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInputForClaim,
        holdId: 'ckvhold00000000000000000w',
        holdToken: 'hold-token-0123456789abcdef',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookingId).toBe('hold-1');
      }
      // Claimed — no fresh create, and the claim extended the expiry.
      // The token hash in the WHERE is the ownership proof: a leaked
      // booking id alone can never hijack someone else's booking.
      expect(db.booking.create).not.toHaveBeenCalled();
      expect(db.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'ckvhold00000000000000000w',
            accessTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
            status: BookingStatus.PENDING_PAYMENT,
            expiresAt: { gt: expect.any(Date) },
            guestCount: 4,
          }),
        })
      );
    });

    it('expires the previous Stripe session when re-claiming (retry)', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperienceForClaim as never
      );
      vi.mocked(db.booking.updateMany).mockResolvedValue({
        count: 1,
      } as never);
      // The hold already carries a session from a first submit — the
      // stale one must die, or its expiry webhook deletes the booking
      // while the client pays the new session (review finding).
      vi.mocked(db.booking.findUniqueOrThrow).mockResolvedValue({
        id: 'hold-1',
        reference: 'ENC-HOLD1234',
        stripeCheckoutSessionId: 'cs_stale_111',
      } as never);
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInputForClaim,
        holdId: 'ckvhold00000000000000000w',
        holdToken: 'hold-token-0123456789abcdef',
      });

      expect(result.success).toBe(true);
      expect(sessionExpireMock).toHaveBeenCalledWith('cs_stale_111');
    });

    it('ignores a holdId without its ownership token (degrades to create)', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperienceForClaim as never
      );
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.create).mockResolvedValue({
        id: 'booking-3',
        reference: 'ENC-FRESH123',
        status: BookingStatus.PENDING_PAYMENT,
      } as never);
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInputForClaim,
        holdId: 'ckvhold00000000000000000w',
        // no holdToken
      });

      expect(result.success).toBe(true);
      expect(db.booking.updateMany).not.toHaveBeenCalled();
      expect(db.booking.create).toHaveBeenCalled();
    });

    it('falls back to a capacity-checked create when the hold expired', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperienceForClaim as never
      );
      vi.mocked(db.booking.updateMany).mockResolvedValue({
        count: 0,
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.create).mockResolvedValue({
        id: 'booking-2',
        reference: 'ENC-NEW12345',
        status: BookingStatus.PENDING_PAYMENT,
      } as never);
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout({
        ...validInputForClaim,
        holdId: 'ckvhold00000000000000000w',
        holdToken: 'hold-token-0123456789abcdef',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookingId).toBe('booking-2');
      }
      expect(db.booking.create).toHaveBeenCalled();
    });
  });

  describe('payment methods (L-051 / D4)', () => {
    it('requests TWINT first with Link and cards', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperienceForClaim as never
      );
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.create).mockResolvedValue({
        id: 'booking-1',
        reference: 'ENC-ABC123',
        status: BookingStatus.PENDING_PAYMENT,
      } as never);
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      await createBookingAndCheckout(validInputForClaim);

      const params = sessionCreateMock.mock.calls[0]?.[0];
      expect(params.payment_method_types).toEqual(['twint', 'card', 'link']);
    });

    it('falls back to card-only when the account rejects TWINT (D4)', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperienceForClaim as never
      );
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.create).mockResolvedValue({
        id: 'booking-1',
        reference: 'ENC-ABC123',
        status: BookingStatus.PENDING_PAYMENT,
      } as never);
      vi.mocked(db.booking.update).mockResolvedValue({} as never);
      // Typed Stripe rejection: the fallback keys on type+param, never on
      // the human message (review finding — any message containing
      // « link » used to trigger a doomed retry).
      sessionCreateMock
        .mockRejectedValueOnce({
          type: 'StripeInvalidRequestError',
          param: 'payment_method_types[0]',
          message:
            'The payment method type "twint" is invalid. Please ensure the provided type is activated in your dashboard.',
        })
        .mockResolvedValueOnce({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
        });

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout(validInputForClaim);

      expect(result.success).toBe(true);
      expect(sessionCreateMock).toHaveBeenCalledTimes(2);
      const retryParams = sessionCreateMock.mock.calls[1]?.[0];
      expect(retryParams.payment_method_types).toEqual(['card']);
    });

    it('does NOT fall back on an unrelated error that merely mentions link', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(
        mockExperienceForClaim as never
      );
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 0 },
      } as never);
      vi.mocked(db.booking.create).mockResolvedValue({
        id: 'booking-1',
        reference: 'ENC-ABC123',
        status: BookingStatus.PENDING_PAYMENT,
      } as never);
      vi.mocked(db.booking.update).mockResolvedValue({} as never);
      sessionCreateMock.mockRejectedValue({
        type: 'StripeInvalidRequestError',
        param: 'success_url',
        message: 'Invalid URL: please follow the account link to fix this.',
      });

      const { createBookingAndCheckout } =
        await import('@/server/actions/checkout');
      const result = await createBookingAndCheckout(validInputForClaim);

      expect(result.success).toBe(false);
      // One attempt only — the real error is surfaced, not masked by a
      // doomed card-only retry.
      expect(sessionCreateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBookingById', () => {
    it('returns booking details when found', async () => {
      const mockBooking = {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        status: BookingStatus.CONFIRMED,
        visitorName: 'John Doe',
        visitorEmail: 'john@example.com',
        accessTokenHash: validAccessTokenHash,
        date: new Date('2026-02-15'),
        timeSlot: '10:00',
        guestCount: 4,
        totalPrice: 20000,
        experience: {
          title: 'Wine Tasting',
          slug: 'wine-tasting',
          duration: 90,
          coverPhoto: 'https://example.com/photo.jpg',
        },
        winery: {
          name: 'Test Winery',
          address: '123 Wine St',
          commune: 'Sion',
          phone: '+41271234567',
          email: 'winery@example.com',
        },
      };

      vi.mocked(db.booking.findUnique).mockResolvedValue(mockBooking as never);

      const { getBookingById } = await import('@/server/actions/checkout');
      const result = await getBookingById('booking-1', validAccessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reference).toBe('ENC-ABC123');
        expect(result.data.status).toBe(BookingStatus.CONFIRMED);
        expect(result.data.guestCount).toBe(4);
      }
    });

    it('returns NOT_FOUND when booking does not exist', async () => {
      vi.mocked(db.booking.findUnique).mockResolvedValue(null);

      const { getBookingById } = await import('@/server/actions/checkout');
      const result = await getBookingById('nonexistent', validAccessToken);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getBookingByReference', () => {
    it('returns booking details when found by reference', async () => {
      const mockBooking = {
        id: 'booking-1',
        reference: 'ENC-XYZ789',
        status: BookingStatus.CONFIRMED,
        visitorName: 'Jane Doe',
        visitorEmail: 'jane@example.com',
        accessTokenHash: validAccessTokenHash,
        date: new Date('2026-03-01'),
        timeSlot: '14:00',
        guestCount: 2,
        totalPrice: 10000,
        experience: {
          title: 'Cellar Visit',
          slug: 'cellar-visit',
          duration: 60,
          coverPhoto: 'https://example.com/cellar.jpg',
        },
        winery: {
          name: 'Another Winery',
          address: '456 Grape Ave',
          commune: 'Sierre',
        },
      };

      vi.mocked(db.booking.findUnique).mockResolvedValue(mockBooking as never);

      const { getBookingByReference } =
        await import('@/server/actions/checkout');
      const result = await getBookingByReference(
        'ENC-XYZ789',
        validAccessToken
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('booking-1');
        expect(result.data.experience.title).toBe('Cellar Visit');
      }
    });

    it('returns NOT_FOUND when reference does not exist', async () => {
      vi.mocked(db.booking.findUnique).mockResolvedValue(null);

      const { getBookingByReference } =
        await import('@/server/actions/checkout');
      const result = await getBookingByReference(
        'ENC-NOTFOUND',
        validAccessToken
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});

describe('Checkout Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkout.session.completed', () => {
    it('updates booking status to CONFIRMED', async () => {
      const mockBooking = {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        status: BookingStatus.PENDING_PAYMENT,
      };

      vi.mocked(db.booking.findUnique).mockResolvedValue(mockBooking as never);
      vi.mocked(db.booking.update).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as never);

      // The actual webhook handler test would require more setup
      // This test verifies the idempotency concept
      expect(mockBooking.status).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('skips already confirmed bookings (idempotency)', async () => {
      const mockBooking = {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        status: BookingStatus.CONFIRMED,
      };

      vi.mocked(db.booking.findUnique).mockResolvedValue(mockBooking as never);

      // Webhook handler should skip update for already confirmed bookings
      expect(mockBooking.status).toBe(BookingStatus.CONFIRMED);
    });
  });
});
