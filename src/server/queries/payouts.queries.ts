import { unstable_cache } from 'next/cache';
import type Stripe from 'stripe';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';

/**
 * Real Stripe payout reads (P-13 / L-141, ENC-114 MVP). Source of truth
 * = Stripe API, NO custom table. Every read is scoped to the winery's
 * connected account (`stripeAccount` header) — the account id always
 * comes from the caller's own winery row, never from client input.
 *
 * DTOs are JSON-serializable (epoch ms, no Date) because they cross
 * unstable_cache. Errors THROW (never cached) — pages catch and render
 * the ENC-114 retry banner.
 */

export type PayoutStatus =
  | 'paid'
  | 'pending'
  | 'in_transit'
  | 'failed'
  | 'canceled';

export interface PayoutListItemDTO {
  id: string;
  status: PayoutStatus;
  /** Net amount received by the winery, in cents. */
  amountCents: number;
  currency: string;
  arrivalDateMs: number;
  createdMs: number;
}

const PAYOUTS_CACHE_SECONDS = 300;

function mapPayoutStatus(status: string): PayoutStatus {
  switch (status) {
    case 'paid':
    case 'pending':
    case 'in_transit':
    case 'failed':
    case 'canceled':
      return status;
    default:
      return 'pending';
  }
}

function toListItem(payout: Stripe.Payout): PayoutListItemDTO {
  return {
    id: payout.id,
    status: mapPayoutStatus(payout.status),
    amountCents: payout.amount,
    currency: payout.currency.toUpperCase(),
    arrivalDateMs: payout.arrival_date * 1000,
    createdMs: payout.created * 1000,
  };
}

/**
 * Latest payouts of the connected account (20 — ENC-114 pagination is
 * deferred debt). Cached 5 min per account.
 */
export async function listWineryPayouts(
  stripeAccountId: string
): Promise<PayoutListItemDTO[]> {
  return unstable_cache(
    async () => {
      const payouts = await getStripe().payouts.list(
        { limit: 20 },
        { stripeAccount: stripeAccountId }
      );
      return payouts.data.map(toListItem);
    },
    ['winery-payouts', stripeAccountId],
    {
      revalidate: PAYOUTS_CACHE_SECONDS,
      tags: [`payouts:${stripeAccountId}`],
    }
  )();
}

export type NextPayoutDTO =
  | {
      kind: 'payout';
      amountCents: number;
      arrivalDateMs: number;
      status: PayoutStatus;
    }
  | { kind: 'balance'; amountCents: number }
  | { kind: 'none' };

/**
 * « Prochain virement » réel (DoD P-13): the earliest pending/in-transit
 * payout, else the pending Stripe balance (funds accruing toward the
 * next automatic payout), else nothing.
 */
export async function getNextPayout(
  stripeAccountId: string
): Promise<NextPayoutDTO> {
  return unstable_cache(
    async () => {
      const payouts = await getStripe().payouts.list(
        { limit: 10 },
        { stripeAccount: stripeAccountId }
      );
      const upcoming = payouts.data
        .filter((p) => p.status === 'pending' || p.status === 'in_transit')
        .sort((a, b) => a.arrival_date - b.arrival_date)[0];
      if (upcoming) {
        return {
          kind: 'payout' as const,
          amountCents: upcoming.amount,
          arrivalDateMs: upcoming.arrival_date * 1000,
          status: mapPayoutStatus(upcoming.status),
        };
      }

      const balance = await getStripe().balance.retrieve({
        stripeAccount: stripeAccountId,
      });
      const pendingCents = balance.pending
        .filter((entry) => entry.currency === 'chf')
        .reduce((sum, entry) => sum + entry.amount, 0);
      return pendingCents > 0
        ? { kind: 'balance' as const, amountCents: pendingCents }
        : { kind: 'none' as const };
    },
    ['winery-next-payout', stripeAccountId],
    {
      revalidate: PAYOUTS_CACHE_SECONDS,
      tags: [`payouts:${stripeAccountId}`],
    }
  )();
}

export interface PayoutBookingLineDTO {
  bookingId: string;
  reference: string;
  experienceTitle: string;
  dateMs: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
}

export interface PayoutDetailDTO {
  payout: PayoutListItemDTO;
  bookings: PayoutBookingLineDTO[];
  /** Balance transactions that could not be matched to a booking. */
  unmatchedLines: { type: string; amountCents: number; createdMs: number }[];
  totalGrossCents: number;
  totalCommissionCents: number;
}

/**
 * Payout composition (ENC-114 detail): the connected account's balance
 * transactions of the payout, correlated back to bookings via
 * transfer.source_transaction.payment_intent → Booking.stripePaymentIntentId
 * (indexed). Destination charges: the connected `py_` payment carries no
 * metadata, only the source_transfer linkage — hence the platform-side
 * transfer hop. Unmatched lines (refund reversals, adjustments, deleted
 * bookings) are listed as-is, never hidden.
 */
export async function getPayoutDetail(
  stripeAccountId: string,
  payoutId: string
): Promise<PayoutDetailDTO | null> {
  return unstable_cache(
    async () => {
      const stripe = getStripe();
      let payout: Stripe.Payout;
      try {
        payout = await stripe.payouts.retrieve(payoutId, {
          stripeAccount: stripeAccountId,
        });
      } catch (error) {
        // Unknown payout on THIS account = not found (no cross-account
        // existence leak).
        if (
          typeof error === 'object' &&
          error !== null &&
          (error as { type?: string }).type === 'StripeInvalidRequestError'
        ) {
          return null;
        }
        throw error;
      }

      const transactions = await stripe.balanceTransactions.list(
        { payout: payoutId, limit: 100, expand: ['data.source'] },
        { stripeAccount: stripeAccountId }
      );

      // payment lines → platform transfer → source charge → PaymentIntent.
      const transferIds: string[] = [];
      for (const txn of transactions.data) {
        if (txn.type !== 'payment') continue;
        const source = txn.source;
        if (
          source !== null &&
          typeof source === 'object' &&
          'source_transfer' in source &&
          typeof source.source_transfer === 'string'
        ) {
          transferIds.push(source.source_transfer);
        }
      }

      const paymentIntentByTransfer = new Map<string, string>();
      await Promise.all(
        transferIds.map(async (transferId) => {
          try {
            // Platform-account call (no stripeAccount header).
            const transfer = await stripe.transfers.retrieve(transferId, {
              expand: ['source_transaction'],
            });
            const sourceTxn = transfer.source_transaction;
            if (
              sourceTxn !== null &&
              typeof sourceTxn === 'object' &&
              'payment_intent' in sourceTxn &&
              typeof sourceTxn.payment_intent === 'string'
            ) {
              paymentIntentByTransfer.set(transferId, sourceTxn.payment_intent);
            }
          } catch {
            // Unresolvable transfer → the line stays unmatched.
          }
        })
      );

      const paymentIntentIds = Array.from(paymentIntentByTransfer.values());
      const bookings = paymentIntentIds.length
        ? await db.booking.findMany({
            where: {
              stripePaymentIntentId: { in: paymentIntentIds },
              // Defense in depth: only THIS winery's bookings can match.
              winery: { stripeAccountId },
            },
            select: {
              id: true,
              reference: true,
              date: true,
              totalPrice: true,
              platformFee: true,
              wineryPayout: true,
              stripePaymentIntentId: true,
              experience: { select: { title: true } },
            },
          })
        : [];
      const bookingByPaymentIntent = new Map(
        bookings.map((booking) => [booking.stripePaymentIntentId, booking])
      );

      const bookingLines: PayoutBookingLineDTO[] = [];
      const unmatchedLines: PayoutDetailDTO['unmatchedLines'] = [];
      for (const txn of transactions.data) {
        if (txn.type === 'payout') continue; // the payout line itself
        const source = txn.source;
        const transferId =
          txn.type === 'payment' &&
          source !== null &&
          typeof source === 'object' &&
          'source_transfer' in source &&
          typeof source.source_transfer === 'string'
            ? source.source_transfer
            : null;
        const paymentIntentId = transferId
          ? paymentIntentByTransfer.get(transferId)
          : undefined;
        const booking = paymentIntentId
          ? bookingByPaymentIntent.get(paymentIntentId)
          : undefined;
        if (booking) {
          bookingLines.push({
            bookingId: booking.id,
            reference: booking.reference,
            experienceTitle: booking.experience.title,
            dateMs: booking.date.getTime(),
            grossCents: booking.totalPrice,
            commissionCents: booking.platformFee,
            netCents: txn.amount,
          });
        } else {
          unmatchedLines.push({
            type: txn.type,
            amountCents: txn.amount,
            createdMs: txn.created * 1000,
          });
        }
      }

      return {
        payout: toListItem(payout),
        bookings: bookingLines.sort((a, b) => b.dateMs - a.dateMs),
        unmatchedLines,
        totalGrossCents: bookingLines.reduce(
          (sum, line) => sum + line.grossCents,
          0
        ),
        totalCommissionCents: bookingLines.reduce(
          (sum, line) => sum + line.commissionCents,
          0
        ),
      };
    },
    ['winery-payout-detail', stripeAccountId, payoutId],
    {
      revalidate: PAYOUTS_CACHE_SECONDS,
      tags: [`payouts:${stripeAccountId}`],
    }
  )();
}

/**
 * Payouts received in the last N days — feeds email #17 (« Virement
 * envoyé : X CHF »). Uncached: called from the weekly cron only.
 */
export async function listRecentPaidPayouts(
  stripeAccountId: string,
  days: number
): Promise<PayoutListItemDTO[]> {
  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  const payouts = await getStripe().payouts.list(
    { limit: 20, arrival_date: { gte: since }, status: 'paid' },
    { stripeAccount: stripeAccountId }
  );
  return payouts.data.map(toListItem);
}
