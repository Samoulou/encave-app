/**
 * Direct DB access for e2e assertions & fixtures (P-16 / L-181). The specs
 * assert on ground truth (booking status, gift ledger) rather than UI text
 * where the UI is not the point of the assertion. Reads .env.test via the
 * Playwright config's dotenv load — same DATABASE_URL as the webServer.
 */
import { PrismaClient } from '@prisma/client';

let client: PrismaClient | null = null;

/** Lazy singleton — Playwright workers each get their own process. */
export function testDb(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

/** Booking by its ENC- reference (unique). */
export async function findBookingByReference(reference: string) {
  return testDb().booking.findFirst({ where: { reference } });
}

/** Latest gift card delivered to this recipient (per-run unique emails). */
export async function findGiftCardByRecipient(recipientEmail: string) {
  return testDb().giftCard.findFirst({
    where: { recipientEmail: recipientEmail.toLowerCase() },
    orderBy: { createdAt: 'desc' },
  });
}

/** Sum of a gift card's ledger — must always equal its balance. */
export async function giftLedgerSum(giftCardId: string): Promise<number> {
  const agg = await testDb().giftCardTransaction.aggregate({
    where: { giftCardId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** Latest sur-mesure request for a client email (per-run unique). */
export async function findRequestByClientEmail(clientEmail: string) {
  return testDb().request.findFirst({
    where: { clientEmail },
    orderBy: { createdAt: 'desc' },
    include: { offers: true },
  });
}

/**
 * Give a PENDING winery a fake Stripe account — the Connect onboarding is
 * not drivable in CI (external hosted flow); the REAL flow is verified on
 * staging (plan P-16 §WS-C.6).
 */
export async function attachFakeStripeAccount(wineryId: string) {
  return testDb().winery.update({
    where: { id: wineryId },
    data: {
      stripeAccountId: `acct_e2e_${wineryId.slice(0, 12)}`,
      stripeOnboardingComplete: true,
      stripeDetailsSubmitted: true,
    },
  });
}

export async function findWineryBySlug(slug: string) {
  return testDb().winery.findUnique({ where: { slug } });
}
