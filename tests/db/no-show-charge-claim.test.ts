/**
 * P-08 no-show fee — the charge CLAIM verified against a REAL migrated
 * database. The claim is a Postgres compare-and-swap on a NULLABLE column
 * (`noShowFeeChargeStatus`): a mocked `db` cannot tell `<> 'PENDING'` (which
 * is NULL — no match — for a never-charged booking) from a correct
 * `IS NULL OR = 'FAILED'`. This suite pins the three states:
 *   - NULL (never charged)  → claimable, exactly once under concurrency;
 *   - FAILED (declined)     → claimable again (the retry);
 *   - PENDING (in flight)   → never claimable.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npm run test:db:invariants
 * Skipped when the env var is absent (the GitHub CI has no Postgres service).
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

// The action module reads env.DATABASE_URL through @/server/db — point the
// real client at the invariants database BEFORE the dynamic import below.
if (url) {
  process.env.DATABASE_URL = url;
}

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn().mockResolvedValue(true),
}));
// Mock getStripe (NOT the `stripe` package) so Stripe.errors.StripeCardError
// stays a real class for the action's instanceof branch.
vi.mock('@/server/stripe', () => ({ getStripe: vi.fn() }));
vi.mock('@/server/services/payment.service', () => ({
  getPlatformCommissionRate: () => 0.1,
}));
vi.mock('@/server/services/email.service', () => ({
  sendNoShowFeeChargedEmail: vi.fn().mockResolvedValue(true),
}));

type NoShowModule = typeof import('@/server/actions/no-show');
type AuthModule = typeof import('@/server/auth');
type StripeModule = typeof import('@/server/stripe');

describe.skipIf(!url)('no-show fee charge claim (P-08)', () => {
  let db: PrismaClient;
  let chargeNoShowFee: NoShowModule['chargeNoShowFee'];
  let auth: AuthModule['auth'];
  let getStripe: StripeModule['getStripe'];
  const paymentIntentsCreate = vi.fn();
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};
  let sequence = 0;

  async function createNoShowBooking(
    chargeStatus: 'PENDING' | 'FAILED' | null
  ): Promise<string> {
    if (!ids.wineryId || !ids.experienceId) {
      throw new Error('fixture not initialised');
    }
    sequence += 1;
    const stamp = `${Date.now().toString().slice(-5)}${sequence}`;
    const booking = await db.booking.create({
      data: {
        reference: `ENC-NS${stamp}`,
        visitorEmail: `no-show-guest-${stamp}@test.encave.ch`,
        visitorName: 'No Show Guest',
        visitorPhone: '+41790000003',
        experienceId: ids.experienceId,
        wineryId: ids.wineryId,
        date: new Date('2026-07-01T00:00:00.000Z'),
        timeSlot: '10:00',
        guestCount: 2,
        totalPrice: 9000,
        platformFee: 900,
        wineryPayout: 8100,
        status: 'NO_SHOW',
        stripeCustomerId: 'cus_test_no_show',
        noShowPaymentMethodId: 'pm_test_no_show',
        noShowFeeCentsSnapshot: 1500,
        noShowPolicyAcceptedAt: new Date('2026-06-01T10:00:00.000Z'),
        noShowFeeChargeStatus: chargeStatus,
      },
    });
    return booking.id;
  }

  beforeAll(async () => {
    ({ chargeNoShowFee } = await import('@/server/actions/no-show'));
    ({ auth } = await import('@/server/auth'));
    ({ getStripe } = await import('@/server/stripe'));
    db = new PrismaClient({ datasourceUrl: url });

    const stamp = Date.now();
    const user = await db.user.create({
      data: {
        email: `no-show-claim-${stamp}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;

    const winery = await db.winery.create({
      data: {
        name: `No Show Claim Winery ${stamp}`,
        slug: `no-show-claim-${stamp}`,
        description: 'No-show claim test fixture',
        address: 'Route du Test 4',
        commune: 'Sion',
        phone: '+41270000003',
        email: `no-show-claim-${stamp}@test.encave.ch`,
        userId: user.id,
        status: 'VERIFIED',
        stripeAccountId: `acct_test_no_show_${stamp}`,
        stripeOnboardingComplete: true,
        noShowFeeEnabled: true,
        noShowFeeCents: 1500,
      },
    });
    ids.wineryId = winery.id;

    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Dégustation sur place',
        slug: `no-show-claim-${stamp}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 60,
        price: 4500,
        minCapacity: 1,
        maxCapacity: 12,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
        paymentMode: 'ON_SITE',
      },
    });
    ids.experienceId = experience.id;

    vi.mocked(auth).mockResolvedValue({
      user: {
        id: user.id,
        email: user.email,
        name: 'No Show Owner',
        role: 'WINEMAKER',
        preferredLocale: 'FR',
      },
    } as never);
    vi.mocked(getStripe).mockReturnValue({
      paymentIntents: { create: paymentIntentsCreate },
    } as never);
  });

  beforeEach(() => {
    paymentIntentsCreate.mockReset();
    // A slow Stripe keeps the winner's claim PENDING while the loser runs —
    // the exact double-tap window.
    paymentIntentsCreate.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { id: `pi_test_${Date.now()}`, status: 'succeeded' };
    });
  });

  afterAll(async () => {
    // Booking→Winery/Experience are Restrict — bookings go first, then the
    // user delete cascades winery + experience.
    if (ids.wineryId) {
      await db.booking
        .deleteMany({ where: { wineryId: ids.wineryId } })
        .catch(() => {});
    }
    if (ids.userId) {
      await db.user.delete({ where: { id: ids.userId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  it('a never-charged no-show (NULL status) is claimed EXACTLY once under two concurrent charges', async () => {
    const bookingId = await createNoShowBooking(null);

    const results = await Promise.all([
      chargeNoShowFee({ bookingId }),
      chargeNoShowFee({ bookingId }),
    ]);

    const charged = results.filter((r) => r.success);
    const refused = results.filter((r) => !r.success);
    expect(charged).toHaveLength(1);
    expect(refused).toHaveLength(1);
    const winner = charged[0];
    if (winner?.success) {
      // 2 guests × the 15.00 fee accepted at booking.
      expect(winner.data.chargedCents).toBe(3000);
    }
    const loser = refused[0];
    if (loser && !loser.success) {
      expect(loser.error.code).toBe('CONFLICT');
      // Lost the CAS, or read after the winner fully committed.
      expect(['CHARGE_IN_PROGRESS', 'ALREADY_CHARGED']).toContain(
        loser.error.message
      );
    }

    // ONE off-session debit, for the accepted amount, net of the 10 % tier.
    expect(paymentIntentsCreate).toHaveBeenCalledTimes(1);
    expect(paymentIntentsCreate.mock.calls[0]?.[0]).toMatchObject({
      amount: 3000,
      application_fee_amount: 300,
      off_session: true,
      confirm: true,
    });

    const row = await db.booking.findUnique({ where: { id: bookingId } });
    expect(row?.noShowFeeChargeStatus).toBe('CHARGED');
    expect(row?.noShowFeeChargedCents).toBe(3000);
    expect(row?.noShowFeeChargePaymentIntentId).toMatch(/^pi_test_/);
  });

  it('a FAILED charge is claimable again (the retry)', async () => {
    const bookingId = await createNoShowBooking('FAILED');

    const result = await chargeNoShowFee({ bookingId });

    expect(result.success).toBe(true);
    expect(paymentIntentsCreate).toHaveBeenCalledTimes(1);
    const row = await db.booking.findUnique({ where: { id: bookingId } });
    expect(row?.noShowFeeChargeStatus).toBe('CHARGED');
  });

  it('a PENDING charge (in flight) is never claimable — no second debit', async () => {
    const bookingId = await createNoShowBooking('PENDING');

    const result = await chargeNoShowFee({ bookingId });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFLICT');
      expect(result.error.message).toBe('CHARGE_IN_PROGRESS');
    }
    expect(paymentIntentsCreate).not.toHaveBeenCalled();
    const row = await db.booking.findUnique({ where: { id: bookingId } });
    expect(row?.noShowFeeChargeStatus).toBe('PENDING');
    expect(row?.noShowFeeChargePaymentIntentId).toBeNull();
  });
});
