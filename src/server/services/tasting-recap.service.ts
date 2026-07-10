import crypto from 'crypto';
import { BookingStatus, type Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { getBaseUrl } from '@/lib/env';
import { logInfo } from '@/lib/logger';
import { sendTastingRecapEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailSkipped,
} from '@/server/services/email-log.service';
import type { ScheduledJobHandlerResult } from '@/server/services/scheduled-jobs.service';

/**
 * TASTING_RECAP job handler (P-07 / L-062, email #3): re-reads everything
 * fresh at run time (wines, prices, booking status, opt-out), mints the
 * order-page token (decision A7) and sends « vos coups de cœur ».
 *
 * Business skips return { ok: false } → the runner parks the job as
 * CANCELLED; a send failure throws → retried by the runner.
 */
export async function processTastingRecapJob(
  payload: Prisma.JsonValue
): Promise<ScheduledJobHandlerResult> {
  const bookingId =
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.bookingId === 'string'
      ? payload.bookingId
      : null;
  if (!bookingId) {
    return { ok: false, skipReason: 'invalid_payload' };
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      visitorEmail: true,
      visitorName: true,
      locale: true,
      tastingRecapSentAt: true,
      winery: { select: { id: true, name: true } },
      wines: {
        select: {
          wine: {
            select: {
              name: true,
              grapeVariety: true,
              vintage: true,
              price: true,
            },
          },
        },
      },
    },
  });
  if (!booking) {
    return { ok: false, skipReason: 'booking_not_found' };
  }
  if (
    booking.status !== BookingStatus.CONFIRMED &&
    booking.status !== BookingStatus.COMPLETED
  ) {
    return { ok: false, skipReason: 'booking_inactive' };
  }
  if (booking.tastingRecapSentAt !== null) {
    // Belt-and-braces dedup on top of the atomic claim.
    return { ok: true, note: 'already_sent' };
  }
  if (booking.wines.length === 0) {
    return { ok: false, skipReason: 'empty_sheet' };
  }

  // Client opt-out (A4): get-or-create the per-email preference row — the
  // unsubscribe token must exist before we link to it from the footer.
  const email = booking.visitorEmail.toLowerCase();
  const preference = await db.clientEmailPreference.upsert({
    where: { email },
    update: {},
    create: { email },
    select: { marketingOptOut: true, unsubscribeToken: true },
  });
  if (preference.marketingOptOut) {
    await logEmailSkipped(
      'tasting_recap',
      booking.visitorEmail,
      'opted_out',
      booking.id,
      { wineryId: booking.winery.id }
    );
    return { ok: false, skipReason: 'opted_out' };
  }

  // Mint the order-page token (A7): the confirmation accessToken plaintext
  // is unrecoverable by J+2, so the recap carries its own.
  const recapToken = crypto.randomBytes(32).toString('hex');
  const recapTokenHash = crypto
    .createHash('sha256')
    .update(recapToken)
    .digest('hex');
  await db.booking.update({
    where: { id: booking.id },
    data: { recapTokenHash },
  });

  const localePath = booking.locale.toLowerCase();
  const result = await sendTastingRecapEmail(
    booking.visitorEmail,
    {
      bookingId: booking.id,
      wineryId: booking.winery.id,
      guestName: booking.visitorName,
      wineryName: booking.winery.name,
      wines: booking.wines.map(({ wine }) => wine),
      orderUrl: `${getBaseUrl()}/${localePath}/booking/${booking.id}/commande?token=${recapToken}`,
      unsubscribeUrl: `${getBaseUrl()}/api/unsubscribe/client/${preference.unsubscribeToken}`,
    },
    booking.locale
  );
  if (!result.ok) {
    throw new Error('tasting_recap_send_failed');
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { tastingRecapSentAt: new Date() },
  });
  await logEmailSent('tasting_recap', booking.visitorEmail, booking.id, {
    resendMessageId: result.messageId,
    wineryId: booking.winery.id,
  });
  logInfo('tasting_recap.sent', {
    action: 'processTastingRecapJob',
    bookingId: booking.id,
    wineryId: booking.winery.id,
  });
  return { ok: true };
}
