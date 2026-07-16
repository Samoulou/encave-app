import { unstable_cache } from 'next/cache';
import type Stripe from 'stripe';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import { logWarn } from '@/lib/logger';

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

/**
 * Destination charges: the connected `py_` payment's only link back to
 * the platform is `source_transfer`. Single extraction point — the
 * collect pass and the render pass must never disagree.
 *
 * P-16 (WS-A.1, defensive — Codex review #121): incoming Connect
 * transfers normally surface on the CONNECTED account as `py_` payments
 * (source_transfer link, handled above), but we also accept a raw
 * `transfer`-typed line whose expanded source is the Transfer itself, so
 * the gift correlation holds regardless of which shape Stripe delivers.
 * The A.2 staging campaign pins down the real one.
 */
function getSourceTransferId(txn: Stripe.BalanceTransaction): string | null {
  const source = txn.source;
  if (source === null || typeof source !== 'object') return null;
  if (txn.type === 'payment') {
    return 'source_transfer' in source &&
      typeof source.source_transfer === 'string'
      ? source.source_transfer
      : null;
  }
  if (txn.type === 'transfer') {
    return 'id' in source && typeof source.id === 'string' ? source.id : null;
  }
  return null;
}

export interface PayoutBookingLineDTO {
  bookingId: string;
  reference: string;
  experienceTitle: string;
  dateMs: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  /**
   * charge = destination charge of the card payment; noShowFee = P-08
   * off-session fee transfer; gift = P-09 separate-charges transfer of
   * the gift-covered payout (correlated via transfer.metadata.bookingId).
   */
  kind: 'charge' | 'noShowFee' | 'gift';
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

      // Auto-paginate: a busy payout can carry more than one page of
      // lines — truncating would silently under-report gross/commission.
      const transactions = await stripe.balanceTransactions
        .list(
          { payout: payoutId, limit: 100, expand: ['data.source'] },
          { stripeAccount: stripeAccountId }
        )
        .autoPagingToArray({ limit: 1000 });

      // payment lines → platform transfer → source charge → PaymentIntent.
      const transferIds = Array.from(
        new Set(
          transactions
            .map(getSourceTransferId)
            .filter((id): id is string => id !== null)
        )
      );

      // Bounded concurrency: an unbounded Promise.all over ~100 transfer
      // retrieves would trip Stripe's read rate limit and silently push
      // real bookings into "unmatched".
      const paymentIntentByTransfer = new Map<string, string>();
      // P-16 (WS-A.1): the gift transfer (P-09, separate charges) has NO
      // source_transaction — its only link back is metadata.bookingId set
      // by settleGiftTransfer. Second correlation map, keyed by transfer.
      const giftBookingIdByTransfer = new Map<string, string>();
      const CHUNK = 10;
      for (let index = 0; index < transferIds.length; index += CHUNK) {
        await Promise.all(
          transferIds.slice(index, index + CHUNK).map(async (transferId) => {
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
                paymentIntentByTransfer.set(
                  transferId,
                  sourceTxn.payment_intent
                );
              } else if (typeof transfer.metadata?.bookingId === 'string') {
                giftBookingIdByTransfer.set(
                  transferId,
                  transfer.metadata.bookingId
                );
              }
            } catch {
              // Unresolvable transfer → the line stays unmatched.
            }
          })
        );
      }

      const paymentIntentIds = Array.from(paymentIntentByTransfer.values());
      const giftBookingIds = Array.from(giftBookingIdByTransfer.values());
      const orClauses = [
        ...(paymentIntentIds.length
          ? [
              { stripePaymentIntentId: { in: paymentIntentIds } },
              { noShowFeeChargePaymentIntentId: { in: paymentIntentIds } },
            ]
          : []),
        // P-16 (WS-A.1): gift transfers correlate by booking id (metadata).
        ...(giftBookingIds.length ? [{ id: { in: giftBookingIds } }] : []),
      ];
      const bookings = orClauses.length
        ? await db.booking.findMany({
            where: {
              // A transfer's payment intent is either the booking charge OR,
              // for P-08, the off-session no-show fee (its PI id lives in a
              // separate column) — and the P-09 gift transfer carries only a
              // bookingId. Match all three.
              OR: orClauses,
              // Defense in depth: only THIS winery's bookings can match — a
              // forged metadata.bookingId from another cave stays unmatched.
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
              noShowFeeChargePaymentIntentId: true,
              noShowFeeChargedCents: true,
              experience: { select: { title: true } },
            },
          })
        : [];
      const bookingByPaymentIntent = new Map(
        bookings.map((booking) => [booking.stripePaymentIntentId, booking])
      );
      // Separate index for the no-show fee transfer (P-08). End-to-end payout
      // correlation is re-verified against Stripe/staging in P-16.
      const bookingByNoShowPaymentIntent = new Map(
        bookings
          .filter((b) => b.noShowFeeChargePaymentIntentId)
          .map((b) => [b.noShowFeeChargePaymentIntentId, b])
      );
      const bookingById = new Map(bookings.map((b) => [b.id, b]));

      const bookingLines: PayoutBookingLineDTO[] = [];
      const unmatchedLines: PayoutDetailDTO['unmatchedLines'] = [];
      for (const txn of transactions) {
        if (txn.type === 'payout') continue; // the payout line itself
        const transferId = getSourceTransferId(txn);
        const paymentIntentId = transferId
          ? paymentIntentByTransfer.get(transferId)
          : undefined;
        const booking = paymentIntentId
          ? bookingByPaymentIntent.get(paymentIntentId)
          : undefined;
        const noShowBooking =
          !booking && paymentIntentId
            ? bookingByNoShowPaymentIntent.get(paymentIntentId)
            : undefined;
        const giftBookingId = transferId
          ? giftBookingIdByTransfer.get(transferId)
          : undefined;
        const giftBooking =
          !booking && !noShowBooking && giftBookingId
            ? bookingById.get(giftBookingId)
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
            kind: 'charge',
          });
        } else if (noShowBooking) {
          // No-show fee transfer (P-08): gross = fee charged, net = what the
          // transfer actually moved, commission = the difference.
          const gross = noShowBooking.noShowFeeChargedCents ?? txn.amount;
          bookingLines.push({
            bookingId: noShowBooking.id,
            reference: noShowBooking.reference,
            experienceTitle: noShowBooking.experience.title,
            dateMs: noShowBooking.date.getTime(),
            grossCents: gross,
            commissionCents: gross - txn.amount,
            netCents: txn.amount,
            kind: 'noShowFee',
          });
        } else if (giftBooking) {
          // Gift transfer (P-09): the single winery-side line of a
          // gift-funded booking moves exactly wineryPayout — anything else
          // is a money-routing anomaly worth a log, never a silent hide.
          if (txn.amount !== giftBooking.wineryPayout) {
            logWarn('gift transfer amount differs from wineryPayout', {
              action: 'getPayoutDetail',
              bookingId: giftBooking.id,
              transferAmountCents: txn.amount,
              wineryPayoutCents: giftBooking.wineryPayout,
            });
          }
          bookingLines.push({
            bookingId: giftBooking.id,
            reference: giftBooking.reference,
            experienceTitle: giftBooking.experience.title,
            dateMs: giftBooking.date.getTime(),
            grossCents: giftBooking.totalPrice,
            commissionCents: giftBooking.platformFee,
            netCents: txn.amount,
            kind: 'gift',
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
