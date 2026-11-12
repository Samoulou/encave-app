import crypto from 'crypto';
import type Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import {
  BookingStatus,
  ExperiencePaymentMode,
  type Prisma,
} from '@prisma/client';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';
import {
  sendBookingConfirmationEmail,
  sendWinemakerNewBookingEmail,
} from '@/server/services/email.service';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { getPostHogServer } from '@/lib/posthog';

export type CheckoutConfirmationSource = 'webhook' | 'confirmation_page';

export type CheckoutConfirmationResult =
  | 'confirmed'
  | 'already_confirmed'
  | 'not_paid'
  | 'not_pending'
  | 'missing_booking'
  | 'missing_metadata'
  | 'session_mismatch'
  | 'missing_payment_intent'
  /**
   * The session is PAID but its total is not what the booking owes
   * (`totalPrice + serviceFeeCents − giftAppliedCents`). Never confirmed —
   * the webhook refunds it through the orphan path and alerts.
   */
  | 'amount_mismatch'
  | 'race_lost';

/**
 * What the card must have been charged for this booking, in cents: tickets
 * + client service fee, net of the gift already applied to the ledger.
 */
export function expectedCardChargeCents(booking: {
  totalPrice: number;
  serviceFeeCents: number;
  giftAppliedCents: number;
}): number {
  return (
    booking.totalPrice + booking.serviceFeeCents - booking.giftAppliedCents
  );
}

/**
 * Cross-check of the PAID amount against the DB (defense in depth: every
 * session is server-built, so a difference means a bug or a stale session
 * that slipped through — never something to confirm silently). Compared
 * only when Stripe reports a CHF total: a synthetic test event carries no
 * `amount_total`, and a presentment-currency total (adaptive pricing) is
 * not comparable to our CHF cents.
 */
function paidAmountMismatch(
  session: Stripe.Checkout.Session,
  booking: {
    totalPrice: number;
    serviceFeeCents: number;
    giftAppliedCents: number;
  }
): { expectedCents: number; paidCents: number } | null {
  if (typeof session.amount_total !== 'number') return null;
  if (session.currency?.toLowerCase() !== 'chf') return null;
  const expectedCents = expectedCardChargeCents(booking);
  if (session.amount_total === expectedCents) return null;
  return { expectedCents, paidCents: session.amount_total };
}

/**
 * The confirmation CAS matched nothing: another writer moved the booking
 * off PENDING_PAYMENT between our read and our update. Say WHICH way it
 * went instead of an opaque `race_lost` — the callers act on it:
 *  - CONFIRMED (the confirmation page / a twin delivery won) →
 *    `already_confirmed`: gift settle and sur-mesure PAID flip still run;
 *  - anything else (cancelled / expired meanwhile) → `not_pending`: the
 *    orphan-refund guard decides whether the charge must go back.
 */
async function resolveLostConfirmationRace(
  bookingId: string
): Promise<CheckoutConfirmationResult> {
  const current = await db.booking.findUnique({
    where: { id: bookingId },
    select: { status: true },
  });
  if (!current) return 'missing_booking';
  return current.status === BookingStatus.CONFIRMED
    ? 'already_confirmed'
    : 'not_pending';
}

export interface CheckoutConfirmationOutcome {
  result: CheckoutConfirmationResult;
  /**
   * Plaintext booking access token — present ONLY when this call performed
   * the confirmation (only the SHA-256 hash is persisted). Callers may use
   * it to render the on-screen ticket QR; it is never recoverable later.
   */
  accessToken?: string;
}

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) {
    return null;
  }

  if (typeof session.payment_intent === 'string') {
    return session.payment_intent;
  }

  return session.payment_intent.id;
}

/**
 * Confirms a pending booking only when Stripe says the Checkout Session is paid.
 * The status update is guarded by PENDING_PAYMENT so webhook/page races remain
 * idempotent and only the winning caller sends confirmation notifications.
 */
export async function confirmBookingFromPaidCheckoutSession(
  session: Stripe.Checkout.Session,
  source: CheckoutConfirmationSource = 'webhook'
): Promise<CheckoutConfirmationOutcome> {
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    logError('No bookingId in session metadata');
    return { result: 'missing_metadata' };
  }

  if (session.payment_status !== 'paid') {
    logInfo('Checkout session is not paid, booking not confirmed', {
      bookingId,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      source,
    });
    return { result: 'not_paid' };
  }

  const paymentIntentId = getPaymentIntentId(session);
  if (!paymentIntentId) {
    logError('Checkout session has no payment intent', undefined, {
      bookingId,
      sessionId: session.id,
      source,
    });
    return { result: 'missing_payment_intent' };
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: bookingConfirmationInclude,
  });

  if (!booking) {
    logError('Booking not found', undefined, { bookingId, source });
    return { result: 'missing_booking' };
  }

  if (
    booking.stripeCheckoutSessionId?.startsWith('cs_') &&
    booking.stripeCheckoutSessionId !== session.id
  ) {
    logError('Checkout session does not match booking', undefined, {
      bookingId,
      bookingSessionId: booking.stripeCheckoutSessionId,
      sessionId: session.id,
      source,
    });
    return { result: 'session_mismatch' };
  }

  if (booking.status === BookingStatus.CONFIRMED) {
    logInfo('Booking already confirmed, skipping', {
      bookingRef: booking.reference,
      source,
    });
    return { result: 'already_confirmed' };
  }

  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    logInfo('Booking not pending payment, not updating', {
      bookingRef: booking.reference,
      status: booking.status,
      source,
    });
    return { result: 'not_pending' };
  }

  const amountMismatch = paidAmountMismatch(session, booking);
  if (amountMismatch) {
    logError(
      'Paid amount does not match the booking — not confirmed',
      undefined,
      {
        bookingId,
        bookingRef: booking.reference,
        sessionId: session.id,
        ...amountMismatch,
        source,
      }
    );
    return { result: 'amount_mismatch' };
  }

  const accessToken = crypto.randomBytes(32).toString('hex');
  const accessTokenHash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex');

  const updated = await db.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.PENDING_PAYMENT },
    data: {
      status: BookingStatus.CONFIRMED,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      expiresAt: null,
      accessTokenHash,
    },
  });

  if (updated.count !== 1) {
    const resolved = await resolveLostConfirmationRace(bookingId);
    logInfo('Booking no longer pending payment after confirmation claim', {
      bookingRef: booking.reference,
      resolved,
      source,
    });
    return { result: resolved };
  }

  logInfo('Booking confirmed from paid checkout session', {
    bookingRef: booking.reference,
    source,
  });

  await sendBookingConfirmationNotifications(booking, accessToken, source);
  return { result: 'confirmed', accessToken };
}

/** Non-identifying, stable analytics id for a booking (sha256, truncated). */
function anonymousAnalyticsId(bookingId: string): string {
  return `booking_${crypto
    .createHash('sha256')
    .update(bookingId)
    .digest('hex')
    .slice(0, 32)}`;
}

const bookingConfirmationInclude = {
  experience: { select: { title: true, duration: true, paymentMode: true } },
  winery: {
    select: {
      name: true,
      email: true,
      address: true,
      commune: true,
      user: { select: { name: true, preferredLocale: true } },
    },
  },
} as const;

type BookingForConfirmation = Prisma.BookingGetPayload<{
  include: typeof bookingConfirmationInclude;
}>;

/**
 * Post-confirmation side effects shared by the paid path and the fully
 * gift-covered path (P-09): analytics + client confirmation email + winery
 * notification. Email failures are logged, never thrown — the booking is
 * already CONFIRMED.
 */
async function sendBookingConfirmationNotifications(
  booking: BookingForConfirmation,
  accessToken: string,
  source: CheckoutConfirmationSource | 'gift' | 'on_site' | 'imprint'
): Promise<void> {
  const posthogServer = getPostHogServer();
  if (posthogServer) {
    posthogServer.capture({
      // Server-side capture has NO consent signal (webhook / cron context,
      // no cookie): never send the visitor's email as the PostHog identity,
      // nor any property that points back at a person. A one-way hash of
      // the booking id keeps events de-duplicable without identifying
      // anyone, and no person profile is created.
      distinctId: anonymousAnalyticsId(booking.id),
      event: 'booking_completed',
      properties: {
        $process_person_profile: false,
        experience_id: booking.experienceId,
        experience_title: booking.experience.title,
        winery_id: booking.wineryId,
        winery_name: booking.winery.name,
        date: booking.date.toISOString(),
        time_slot: booking.timeSlot,
        guest_count: booking.guestCount,
        total_price_chf: booking.totalPrice / 100,
        service_fee_chf: booking.serviceFeeCents / 100,
        total_paid_chf: (booking.totalPrice + booking.serviceFeeCents) / 100,
        platform_fee_chf: booking.platformFee / 100,
        winery_payout_chf: booking.wineryPayout / 100,
        gift_applied_chf: booking.giftAppliedCents / 100,
        source,
      },
    });
    // Best-effort analytics — never on the confirmation path: an awaited
    // flush could stall (PostHog slow/unreachable) or throw BEFORE the
    // client email below, on a booking that is already CONFIRMED and paid.
    void posthogServer.flush().catch(() => {});
  }

  const bookingDateTime = zonedWallClockToUTC(booking.date, booking.timeSlot);

  try {
    const confirmationSent = await sendBookingConfirmationEmail(
      booking.visitorEmail,
      {
        bookingId: booking.id,
        accessToken,
        guestName: booking.visitorName,
        experienceTitle: booking.experience.title,
        wineryName: booking.winery.name,
        wineryAddress: booking.winery.address,
        wineryCommune: booking.winery.commune,
        date: bookingDateTime,
        timeSlot: booking.timeSlot,
        guestCount: booking.guestCount,
        duration: booking.experience.duration,
        totalPrice: booking.totalPrice,
        serviceFeeCents: booking.serviceFeeCents,
        bookingRef: booking.reference,
      },
      // Client email in the CLIENT's locale (persisted at checkout), NOT the
      // winemaker's — the winery notification below keeps its own locale.
      booking.locale
    );
    // sendEmail resolves `false` (it does not throw) when Resend refused
    // the message after its retries, or when the key is missing in
    // production. Stamp the dedupe flag ONLY on a real send — a false
    // "sent" hides a paid client left without ticket.
    if (confirmationSent) {
      await db.booking.update({
        where: { id: booking.id },
        data: { confirmationSentAt: new Date() },
      });
    } else {
      reportConfirmationEmailFailure('client_confirmation', booking.id, source);
    }
  } catch (error) {
    logError('Failed to send confirmation email', error, {
      bookingId: booking.id,
      source,
    });
    reportConfirmationEmailFailure(
      'client_confirmation',
      booking.id,
      source,
      error
    );
  }

  try {
    const wineryNotified = await sendWinemakerNewBookingEmail(
      booking.winery.email,
      {
        winemakerName: booking.winery.user.name ?? 'Winemaker',
        experienceTitle: booking.experience.title,
        date: bookingDateTime,
        guestCount: booking.guestCount,
        totalPrice: booking.wineryPayout,
        guestName: booking.visitorName,
        guestEmail: booking.visitorEmail,
        bookingRef: booking.reference,
      },
      booking.winery.user.preferredLocale
    );
    if (wineryNotified) {
      await db.booking.update({
        where: { id: booking.id },
        data: { wineryNotifiedAt: new Date() },
      });
    } else {
      reportConfirmationEmailFailure('winery_new_booking', booking.id, source);
    }
  } catch (error) {
    logError('Failed to send winery notification', error, {
      bookingId: booking.id,
      source,
    });
    reportConfirmationEmailFailure(
      'winery_new_booking',
      booking.id,
      source,
      error
    );
  }
}

/**
 * A confirmation email that did not go out is an incident on a CONFIRMED
 * (usually paid) booking: the dedupe stamp stays null and Sentry is told
 * (alert rule on area:email) instead of leaving a Pino line nobody reads.
 */
function reportConfirmationEmailFailure(
  email: 'client_confirmation' | 'winery_new_booking',
  bookingId: string,
  source: CheckoutConfirmationSource | 'gift' | 'on_site' | 'imprint',
  error?: unknown
): void {
  if (error === undefined) {
    logError('Confirmation email was not sent', undefined, {
      bookingId,
      email,
      source,
    });
  }
  Sentry.captureMessage(`booking ${email} email not sent`, {
    level: 'error',
    tags: { area: 'email', email },
    extra: {
      bookingId,
      source,
      ...(error !== undefined ? { error: String(error) } : {}),
    },
  });
}

/**
 * Confirm a booking fully covered by a gift card (P-09, Luca design §4):
 * no Stripe session exists (Checkout refuses a 0 total), so the redemption
 * already reserved the funds and we confirm server-side. The platform→winery
 * transfer is settled separately by the caller (settleGiftTransfer). Guarded
 * by the PENDING_PAYMENT claim → idempotent against a double call.
 */
export async function confirmGiftFullyCoveredBooking(
  bookingId: string
): Promise<CheckoutConfirmationOutcome> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: bookingConfirmationInclude,
  });
  if (!booking) return { result: 'missing_booking' };
  if (booking.status === BookingStatus.CONFIRMED) {
    return { result: 'already_confirmed' };
  }
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    return { result: 'not_pending' };
  }
  if (booking.giftAppliedCents <= 0) {
    // Not actually gift-covered — never confirm a booking for free.
    return { result: 'not_paid' };
  }

  const accessToken = crypto.randomBytes(32).toString('hex');
  const accessTokenHash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex');

  const updated = await db.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.PENDING_PAYMENT },
    data: {
      status: BookingStatus.CONFIRMED,
      expiresAt: null,
      accessTokenHash,
    },
  });
  if (updated.count !== 1) return { result: 'race_lost' };

  logInfo('Gift-fully-covered booking confirmed', {
    bookingRef: booking.reference,
  });
  await sendBookingConfirmationNotifications(booking, accessToken, 'gift');
  return { result: 'confirmed', accessToken };
}

/**
 * Confirm an ON_SITE / free booking that carries no card imprint (P-08):
 * the winery opted out of no-show fees (or the flag is OFF), so there is no
 * online charge and no SetupIntent. The experience price is settled at the
 * winery. Guarded by the ON_SITE payment mode (never confirm an ONLINE,
 * genuinely-payable booking for free) and by the PENDING_PAYMENT claim.
 */
export async function confirmOnSiteBooking(
  bookingId: string
): Promise<CheckoutConfirmationOutcome> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: bookingConfirmationInclude,
  });
  if (!booking) return { result: 'missing_booking' };
  if (booking.experience.paymentMode !== ExperiencePaymentMode.ON_SITE) {
    // Never confirm an ONLINE booking without payment.
    return { result: 'not_paid' };
  }
  if (booking.status === BookingStatus.CONFIRMED) {
    return { result: 'already_confirmed' };
  }
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    return { result: 'not_pending' };
  }

  const accessToken = crypto.randomBytes(32).toString('hex');
  const accessTokenHash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex');

  const updated = await db.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.PENDING_PAYMENT },
    data: {
      status: BookingStatus.CONFIRMED,
      expiresAt: null,
      accessTokenHash,
    },
  });
  if (updated.count !== 1) return { result: 'race_lost' };

  logInfo('On-site booking confirmed (no imprint)', {
    bookingRef: booking.reference,
  });
  await sendBookingConfirmationNotifications(booking, accessToken, 'on_site');
  return { result: 'confirmed', accessToken };
}

/**
 * Confirm an ON_SITE booking whose no-show card imprint (Stripe Checkout
 * mode:'setup') just completed (P-08, US-220). Persists the vaulted card
 * (Customer + payment method) so the winemaker can charge the no-show fee
 * off-session later — ZERO debit here. A setup session reports
 * payment_status 'no_payment_required' and carries a setup_intent, not a
 * payment_intent, so confirmBookingFromPaidCheckoutSession would no-op it.
 * Guarded by the PENDING_PAYMENT claim → idempotent on webhook redelivery.
 */
export async function confirmImprintBookingFromSetupSession(
  session: Stripe.Checkout.Session
): Promise<CheckoutConfirmationOutcome> {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    logError('No bookingId in setup session metadata');
    return { result: 'missing_metadata' };
  }

  const setupIntentId =
    typeof session.setup_intent === 'string'
      ? session.setup_intent
      : (session.setup_intent?.id ?? null);
  if (!setupIntentId) {
    logError('Setup session has no setup intent', undefined, {
      bookingId,
      sessionId: session.id,
    });
    return { result: 'missing_payment_intent' };
  }

  const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId);
  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : (setupIntent.payment_method?.id ?? null);
  const customerId =
    (typeof session.customer === 'string'
      ? session.customer
      : (session.customer?.id ?? null)) ??
    (typeof setupIntent.customer === 'string'
      ? setupIntent.customer
      : (setupIntent.customer?.id ?? null));

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: bookingConfirmationInclude,
  });
  if (!booking) {
    logError('Booking not found', undefined, { bookingId });
    return { result: 'missing_booking' };
  }

  if (
    booking.stripeCheckoutSessionId?.startsWith('cs_') &&
    booking.stripeCheckoutSessionId !== session.id
  ) {
    return { result: 'session_mismatch' };
  }
  if (booking.status === BookingStatus.CONFIRMED) {
    return { result: 'already_confirmed' };
  }
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    return { result: 'not_pending' };
  }

  if (!paymentMethodId || !customerId) {
    // The client completed the setup but Stripe returned no card to vault —
    // confirm the booking anyway (the guest showed up to book) but no fee can
    // be charged later. The charge action guards on the imprint's presence.
    logWarn('Setup session completed without a vaultable card', {
      bookingRef: booking.reference,
      hasPaymentMethod: Boolean(paymentMethodId),
      hasCustomer: Boolean(customerId),
    });
  }

  const accessToken = crypto.randomBytes(32).toString('hex');
  const accessTokenHash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex');

  const updated = await db.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.PENDING_PAYMENT },
    data: {
      status: BookingStatus.CONFIRMED,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: customerId,
      noShowSetupIntentId: setupIntentId,
      noShowPaymentMethodId: paymentMethodId,
      expiresAt: null,
      accessTokenHash,
    },
  });
  if (updated.count !== 1) return { result: 'race_lost' };

  logInfo('No-show imprint booking confirmed from setup session', {
    bookingRef: booking.reference,
  });
  await sendBookingConfirmationNotifications(booking, accessToken, 'imprint');
  return { result: 'confirmed', accessToken };
}
