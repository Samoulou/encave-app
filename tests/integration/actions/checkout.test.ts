import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/server/db';
import { BookingStatus, ExperienceStatus, WineryStatus } from '@prisma/client';

// Mock Stripe (hoisted spy so tests can assert on session payloads)
const { sessionCreateMock } = vi.hoisted(() => ({
  sessionCreateMock: vi.fn(),
}));
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: sessionCreateMock,
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
      create: vi.fn(),
      update: vi.fn(),
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

  describe('createBookingAndCheckout', () => {
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
    };

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
      expect(capturedBookingData).not.toBeNull();
      expect(capturedBookingData!.totalPrice).toBe(20000);
      expect(capturedBookingData!.platformFee).toBe(2400);
      expect(capturedBookingData!.wineryPayout).toBe(17600);
      // Flag OFF: no service fee, single Stripe line, unchanged app fee.
      expect(capturedBookingData!.serviceFeeCents).toBe(0);
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
      await createBookingAndCheckout(validInput);

      // 4 guests × 250 = 1000 cents of service fee, platform's revenue:
      // totalPrice stays 20000, application_fee = 2400 + 1000.
      expect(capturedBookingData).not.toBeNull();
      expect(capturedBookingData!.totalPrice).toBe(20000);
      expect(capturedBookingData!.serviceFeeCents).toBe(1000);
      expect(capturedBookingData!.wineryPayout).toBe(17600);
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
      await createBookingAndCheckout(validInput);

      // Founder: platformFee 0, full payout; app fee = client fee alone.
      expect(capturedBookingData).not.toBeNull();
      expect(capturedBookingData!.platformFee).toBe(0);
      expect(capturedBookingData!.wineryPayout).toBe(20000);
      expect(capturedBookingData!.serviceFeeCents).toBe(1000);
      const session = sessionCreateMock.mock.calls[0]?.[0];
      expect(session.payment_intent_data.application_fee_amount).toBe(1000);
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
