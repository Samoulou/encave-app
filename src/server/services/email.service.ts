import { Resend } from 'resend';
import { render } from '@react-email/components';
import { env, getBaseUrl } from '@/lib/env';
import { logInfo, logError, logWarn } from '@/lib/logger';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale as RoutingLocale } from '@/i18n/routing';
import type { Locale } from '@prisma/client';
import {
  BookingConfirmationEmail,
  BookingReminderEmail,
  BookingCancellationEmail,
  BookingCancelledByWineryEmail,
  BookingExpiredEmail,
  ManualRefundClientEmail,
  ManualRefundWinemakerEmail,
  NoShowFeeChargedEmail,
  AccountDeletedEmail,
  PasswordResetEmail,
  WelcomeEmail,
  EmailVerificationEmail,
  WinemakerNewBookingEmail,
  WinemakerCancellationEmail,
  WineryApprovedEmail,
  WineryRejectedEmail,
  ClientReminder2hEmail,
  DailyDigestEmail,
  PostExperienceFollowUpEmail,
  WeeklySummaryEmail,
  TastingRecapEmail,
  type TastingRecapWine,
  WineOrderRequestWineryEmail,
  WineOrderRequestClientEmail,
  type WineOrderRequestItemLine,
  TastingSheetReminderEmail,
  type ReminderSessionLine,
  StripeActionRequiredEmail,
  GiftCardPurchaseEmail,
  GiftCardDeliveryEmail,
  RequestSubmittedEmail,
  RequestNewCustomEmail,
  RequestOfferReceivedEmail,
  RequestOfferExpiringEmail,
  RequestSlaEscalationEmail,
  ContactMessageEmail,
  ContactAckEmail,
} from '@/emails';
import { subjects, t } from '@/emails/translations';
import { generateBookingQrPng } from '@/server/services/qr-code.service';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const FROM_EMAIL = 'EnCave <noreply@encave.ch>';
const DEFAULT_LOCALE: Locale = 'FR';

// BACK-004 FIX: Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Optional reply-to (P-12 / L-114 contact form routes replies to sender). */
  replyTo?: string;
  attachments?: {
    filename: string;
    content: string;
    contentType?: string;
    cid?: string;
  }[];
  /**
   * Resend tags (P-07 tracking): surfaced back by the open/click webhook.
   * Values must be ASCII letters, numbers, underscores or dashes.
   */
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  ok: boolean;
  /** Resend message id — matches webhook events to EmailLog rows. */
  messageId?: string;
}

/**
 * BACK-004 FIX: Send email with exponential backoff retry
 * Retries up to 3 times with delays of 1s, 2s, 4s.
 * Detailed variant (P-07): also returns the Resend message id so the
 * open/click webhook can be matched back to the EmailLog row.
 */
async function sendEmailDetailed({
  to,
  subject,
  html,
  replyTo,
  attachments,
  tags,
}: SendEmailOptions): Promise<SendEmailResult> {
  if (!resend) {
    // In production a missing RESEND_API_KEY is an outage, not a no-op:
    // returning success would set dedup flags (confirmationSentAt, …) and
    // mark EmailLog entries "sent" while nothing was delivered.
    if (process.env.NODE_ENV === 'production') {
      logError(
        'RESEND_API_KEY missing in production — email NOT sent',
        undefined,
        {
          to,
          subject,
        }
      );
      return { ok: false };
    }
    logInfo('Resend not configured, skipping email (non-production)', {
      to,
      subject,
    });
    return { ok: true };
  }

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
        attachments,
        tags,
      });

      if (error) {
        logWarn(`Email attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed`, {
          to,
          subject,
          attempt,
          error: String(error),
        });
        if (attempt === MAX_RETRY_ATTEMPTS) {
          logError('Email max retries reached', error, { to, subject });
          return { ok: false };
        }
        // Wait before retrying (exponential backoff: 1s, 2s, 4s)
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return { ok: true, messageId: data?.id };
    } catch (error) {
      logWarn(`Email attempt ${attempt}/${MAX_RETRY_ATTEMPTS} error`, {
        to,
        subject,
        attempt,
      });
      if (attempt === MAX_RETRY_ATTEMPTS) {
        logError('Email max retries reached', error, { to, subject });
        return { ok: false };
      }
      // Wait before retrying
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { ok: false };
}

async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { ok } = await sendEmailDetailed(options);
  return ok;
}

function getLocale(locale?: Locale | null): Locale {
  return locale ?? DEFAULT_LOCALE;
}

// Booking Emails

export interface BookingConfirmationData {
  bookingId?: string;
  accessToken?: string;
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  date: Date;
  guestCount: number;
  duration: number;
  totalPrice: number;
  /** Client booking fee in cents (0 when BOOKING_FEE is OFF). */
  serviceFeeCents?: number;
  bookingRef: string;
}

export async function sendBookingConfirmationEmail(
  email: string,
  data: BookingConfirmationData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const localePath = loc.toLowerCase();
  const bookingUrl =
    data.bookingId && data.accessToken
      ? `${getBaseUrl()}/${localePath}/booking/${data.bookingId}?token=${data.accessToken}`
      : `${getBaseUrl()}/${localePath}`;
  const html = await render(
    BookingConfirmationEmail({
      locale: loc,
      ...data,
      qrCodeCid: data.accessToken ? 'booking-qr-code' : undefined,
      bookingUrl,
    })
  );

  const attachments: SendEmailOptions['attachments'] = [];
  if (data.accessToken) {
    try {
      const qrPng = await generateBookingQrPng(bookingUrl);
      attachments.push({
        filename: `billet-${data.bookingRef}.png`,
        content: qrPng.toString('base64'),
        contentType: 'image/png',
        cid: 'booking-qr-code',
      });
    } catch (error) {
      logError('Failed to generate booking QR code', error, {
        action: 'sendBookingConfirmationEmail',
        bookingRef: data.bookingRef,
      });
    }
  }

  return sendEmail({
    to: email,
    subject: t(subjects.bookingConfirmation, loc),
    html,
    attachments,
  });
}

export interface BookingExpiredData {
  guestName: string;
  experienceTitle: string;
  date: Date;
  experienceSlug: string;
}

export async function sendBookingExpiredEmail(
  email: string,
  data: BookingExpiredData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    BookingExpiredEmail({
      locale: loc,
      ...data,
      experienceUrl: `${getBaseUrl()}/${loc.toLowerCase()}/experiences/${data.experienceSlug}`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.bookingExpired, loc),
    html,
  });
}

export interface BookingCancelledByWineryData {
  guestName: string;
  winemakerName: string;
  experienceTitle: string;
  date: Date;
  amountCents: number;
  reason: string;
}

export async function sendBookingCancelledByWineryEmail(
  email: string,
  data: BookingCancelledByWineryData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    BookingCancelledByWineryEmail({
      locale: loc,
      ...data,
      experiencesUrl: `${getBaseUrl()}/${loc.toLowerCase()}/experiences`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.bookingCancelledByWinery, loc).replace(
      '{winemakerName}',
      data.winemakerName
    ),
    html,
  });
}

export interface BookingReminderData {
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  wineryAddress: string;
  date: Date;
  guestCount: number;
  bookingRef: string;
  isTomorrow?: boolean;
}

export async function sendBookingReminderEmail(
  email: string,
  data: BookingReminderData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    BookingReminderEmail({
      locale: loc,
      ...data,
      directionsUrl: `https://maps.google.com/?q=${encodeURIComponent(data.wineryAddress)}`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.bookingReminder, loc),
    html,
  });
}

export interface BookingCancellationData {
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  date: Date;
  totalPrice: number;
  /** Exact refunded cents (policy-based); 0 = no refund; null = unknown. */
  refundAmountCents?: number | null;
  bookingRef: string;
}

export async function sendBookingCancellationEmail(
  email: string,
  data: BookingCancellationData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    BookingCancellationEmail({
      locale: loc,
      ...data,
      experiencesUrl: `${getBaseUrl()}/experiences`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.bookingCancellation, loc),
    html,
  });
}

// Authentication Emails

export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetUrl: string,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    PasswordResetEmail({
      locale: loc,
      userName,
      resetUrl,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.passwordReset, loc),
    html,
  });
}

export async function sendWelcomeEmail(
  email: string,
  userName: string,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    WelcomeEmail({
      locale: loc,
      userName,
      experiencesUrl: `${getBaseUrl()}/experiences`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.welcome, loc),
    html,
  });
}

export async function sendEmailVerificationEmail(
  email: string,
  userName: string,
  verificationUrl: string,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    EmailVerificationEmail({
      locale: loc,
      userName,
      verificationUrl,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.emailVerification, loc),
    html,
  });
}

export async function sendAccountDeletedEmail(
  email: string,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    AccountDeletedEmail({
      locale: loc,
      date: new Date(),
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.accountDeleted, loc),
    html,
  });
}

// Winemaker Notification Emails

export interface WinemakerNewBookingData {
  winemakerName: string;
  experienceTitle: string;
  date: Date;
  guestCount: number;
  totalPrice: number;
  guestName: string;
  guestEmail: string;
  bookingRef: string;
}

export async function sendWinemakerNewBookingEmail(
  email: string,
  data: WinemakerNewBookingData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    WinemakerNewBookingEmail({
      locale: loc,
      ...data,
      dashboardUrl: `${getBaseUrl()}/dashboard/bookings`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.wineryNewBooking, loc),
    html,
  });
}

export interface WinemakerCancellationData {
  winemakerName: string;
  experienceTitle: string;
  date: Date;
  guestCount: number;
  guestName: string;
  bookingRef: string;
}

export async function sendWinemakerCancellationEmail(
  email: string,
  data: WinemakerCancellationData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    WinemakerCancellationEmail({
      locale: loc,
      ...data,
      dashboardUrl: `${getBaseUrl()}/dashboard/bookings`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.wineryCancellation, loc),
    html,
  });
}

export async function sendManualRefundClientEmail(
  email: string,
  data: {
    firstName: string;
    reference: string;
    experienceTitle: string;
    amountCents: number;
  },
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    ManualRefundClientEmail({
      locale: loc,
      ...data,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.manualRefundClient, loc),
    html,
  });
}

export async function sendManualRefundWinemakerEmail(
  email: string,
  data: {
    firstName: string;
    reference: string;
    experienceTitle: string;
    date: Date;
    amountCents: number;
    reason: string;
  },
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    ManualRefundWinemakerEmail({
      locale: loc,
      ...data,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.manualRefundWinemaker, loc),
    html,
  });
}

/**
 * Email #13 (P-08): no-show fee charged, to the CLIENT — send in the booking's
 * locale (never the winemaker's preferredLocale).
 */
export async function sendNoShowFeeChargedEmail(
  email: string,
  data: {
    firstName: string;
    reference: string;
    experienceTitle: string;
    wineryName: string;
    date: Date;
    amountCents: number;
    acceptedAt: Date;
  },
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    NoShowFeeChargedEmail({
      locale: loc,
      ...data,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.noShowFeeCharged, loc),
    html,
  });
}

// Winery Verification Emails

export async function sendWineryApprovedEmail(
  email: string,
  winemakerName: string,
  wineryName: string,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    WineryApprovedEmail({
      locale: loc,
      winemakerName,
      wineryName,
      dashboardUrl: `${getBaseUrl()}/dashboard`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.wineryApproved, loc),
    html,
  });
}

export async function sendWineryRejectedEmail(
  email: string,
  winemakerName: string,
  wineryName: string,
  reason: string,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    WineryRejectedEmail({
      locale: loc,
      winemakerName,
      wineryName,
      reason,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.wineryRejected, loc),
    html,
  });
}

// Automated Notification Emails

export interface ClientReminder2hData {
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  wineryAddress: string;
  wineryPhone: string;
  date: Date;
  guestCount: number;
}

export async function sendClientReminder2hEmail(
  email: string,
  data: ClientReminder2hData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    ClientReminder2hEmail({
      locale: loc,
      ...data,
      directionsUrl: `https://maps.google.com/?q=${encodeURIComponent(data.wineryAddress)}`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.reminder2h, loc),
    html,
  });
}

export interface DailyDigestBooking {
  time: string;
  experienceTitle: string;
  guestName: string;
  guestCount: number;
}

export interface DailyDigestData {
  winemakerName: string;
  wineryName: string;
  todayBookings: DailyDigestBooking[];
  tomorrowBookings: DailyDigestBooking[];
}

export async function sendDailyDigestEmail(
  email: string,
  data: DailyDigestData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    DailyDigestEmail({
      locale: loc,
      ...data,
      dashboardUrl: `${getBaseUrl()}/dashboard/bookings`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.dailyDigest, loc),
    html,
  });
}

export interface PostExperienceFollowUpData {
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  date: Date;
}

export async function sendPostExperienceFollowUpEmail(
  email: string,
  data: PostExperienceFollowUpData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    PostExperienceFollowUpEmail({
      locale: loc,
      ...data,
      experiencesUrl: `${getBaseUrl()}/experiences`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.postExperience, loc),
    html,
  });
}

export interface WeeklySummaryStats {
  bookings: number;
  guests: number;
  revenue: number;
}

export interface WeeklySummaryData {
  winemakerName: string;
  wineryName: string;
  lastWeekStats: WeeklySummaryStats;
  thisWeekPreview: {
    bookings: number;
    guests: number;
  };
  /** Real Stripe payouts of the last 7 days (P-13 / email #17). */
  payouts?: { totalCents: number; count: number } | null;
  /** Previous-month statement (P-13 / email #17). */
  statement?: { monthKey: string; monthLabel: string } | null;
}

export async function sendWeeklySummaryEmail(
  email: string,
  data: WeeklySummaryData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const { statement, ...rest } = data;
  const html = await render(
    WeeklySummaryEmail({
      locale: loc,
      ...rest,
      statement: statement
        ? {
            // Session-authenticated route — fine for winemakers, who stay
            // logged in on their own device.
            url: `${getBaseUrl()}/api/dashboard/statements/${statement.monthKey}?locale=${loc.toLowerCase()}`,
            monthLabel: statement.monthLabel,
          }
        : null,
      dashboardUrl: `${getBaseUrl()}/dashboard/earnings`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.weeklySummary, loc),
    html,
  });
}

/**
 * Email #18 « Action requise Stripe » (P-13 / L-143). Caller (Connect
 * webhook) owns the anti-spam decision — this only renders and sends.
 */
export async function sendStripeActionRequiredEmail(
  email: string,
  data: { firstName: string; currentlyDue: string[] },
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    StripeActionRequiredEmail({
      locale: loc,
      firstName: data.firstName,
      currentlyDue: data.currentlyDue,
      profileUrl: `${getBaseUrl()}/dashboard/winery/profile`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.stripeActionRequired, loc),
    html,
  });
}

// Tasting loop emails (P-07 / US-230)

export interface TastingRecapEmailData {
  bookingId: string;
  wineryId: string;
  guestName: string;
  wineryName: string;
  wines: TastingRecapWine[];
  /** Tokenized wine-order page URL (D3). */
  orderUrl: string;
  /** Tokenized client opt-out URL (LCD). */
  unsubscribeUrl: string;
}

/**
 * Email #3 « Vos coups de cœur », J+2. Returns the detailed result so the
 * scheduled-job handler can persist the Resend message id (tracking A3).
 */
export async function sendTastingRecapEmail(
  email: string,
  data: TastingRecapEmailData,
  locale?: Locale | null
): Promise<SendEmailResult> {
  const loc = getLocale(locale);
  const html = await render(
    TastingRecapEmail({
      locale: loc,
      guestName: data.guestName,
      wineryName: data.wineryName,
      wines: data.wines,
      orderUrl: data.orderUrl,
      unsubscribeUrl: data.unsubscribeUrl,
    })
  );

  return sendEmailDetailed({
    to: email,
    subject: t(subjects.tastingRecap, loc).replace(
      '{wineryName}',
      data.wineryName
    ),
    html,
    tags: [
      { name: 'email_type', value: 'tasting_recap' },
      { name: 'winery_id', value: data.wineryId },
      { name: 'booking_id', value: data.bookingId },
    ],
  });
}

export interface WineOrderRequestEmailData {
  bookingId: string;
  wineryId: string;
  bookingReference: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  wineryName: string;
  items: WineOrderRequestItemLine[];
  totalCents: number;
}

/**
 * Order request → winery (winemaker locale) + confirmation copy → client
 * (Booking.locale). The winery email is the deliverable at launch (A6);
 * when it fails, the client copy ("we forwarded your request") would be
 * a lie — it is skipped, and the caller escalates the failure.
 */
export async function sendWineOrderRequestEmails(
  wineryEmail: string,
  data: WineOrderRequestEmailData,
  wineryLocale: Locale | null | undefined,
  clientLocale: Locale | null | undefined
): Promise<{ winery: boolean; client: boolean }> {
  const wineryLoc = getLocale(wineryLocale);
  const clientLoc = getLocale(clientLocale);

  const wineryHtml = await render(
    WineOrderRequestWineryEmail({
      locale: wineryLoc,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      bookingReference: data.bookingReference,
      items: data.items,
      totalCents: data.totalCents,
    })
  );
  const wineryResult = await sendEmailDetailed({
    to: wineryEmail,
    subject: t(subjects.wineOrderRequestWinery, wineryLoc).replace(
      '{clientName}',
      data.clientName
    ),
    html: wineryHtml,
    tags: [
      { name: 'email_type', value: 'wine_order_request' },
      { name: 'winery_id', value: data.wineryId },
      { name: 'booking_id', value: data.bookingId },
    ],
  });

  if (!wineryResult.ok) {
    return { winery: false, client: false };
  }

  const clientHtml = await render(
    WineOrderRequestClientEmail({
      locale: clientLoc,
      wineryName: data.wineryName,
      items: data.items,
      totalCents: data.totalCents,
    })
  );
  const clientResult = await sendEmailDetailed({
    to: data.clientEmail,
    subject: t(subjects.wineOrderRequestClient, clientLoc).replace(
      '{wineryName}',
      data.wineryName
    ),
    html: clientHtml,
  });

  return { winery: true, client: clientResult.ok };
}

export interface TastingSheetReminderData {
  wineryId: string;
  firstName: string;
  sessions: ReminderSessionLine[];
  /** Deep link to the sessions calendar of the concerned experience. */
  sheetUrl: string;
}

/** Email #21 — 21h empty-sheet reminder to the winemaker (L-063). */
export async function sendTastingSheetReminderEmail(
  email: string,
  data: TastingSheetReminderData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    TastingSheetReminderEmail({
      locale: loc,
      firstName: data.firstName,
      sessions: data.sessions,
      sheetUrl: data.sheetUrl,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.tastingSheetReminder, loc),
    html,
    tags: [
      { name: 'email_type', value: 'tasting_sheet_reminder' },
      { name: 'winery_id', value: data.wineryId },
    ],
  });
}

export interface GiftCardPurchaseEmailData {
  giftCardId: string;
  purchaserName: string;
  recipientName: string;
  /** Pre-formatted card value, e.g. "CHF 100.00". */
  amount: string;
  /** Display code (grouped, e.g. "ABCD EFGH JKMN"). */
  code: string;
  deliverDate: string;
  expiryDate: string;
  /** Personalised PDF, attached to the email. */
  pdf: Buffer;
}

/** Email #6 — purchaser confirmation, immediate (P-09 / L-083). */
export async function sendGiftCardPurchaseEmail(
  email: string,
  data: GiftCardPurchaseEmailData,
  locale?: Locale | null
): Promise<SendEmailResult> {
  const loc = getLocale(locale);
  const html = await render(
    GiftCardPurchaseEmail({
      locale: loc,
      purchaserName: data.purchaserName,
      recipientName: data.recipientName,
      amount: data.amount,
      code: data.code,
      deliverDate: data.deliverDate,
      expiryDate: data.expiryDate,
    })
  );

  return sendEmailDetailed({
    to: email,
    subject: t(subjects.giftCardPurchase, loc),
    html,
    attachments: [
      {
        filename: 'bon-cadeau-encave.pdf',
        content: data.pdf.toString('base64'),
        contentType: 'application/pdf',
      },
    ],
    tags: [
      { name: 'email_type', value: 'gift_card_purchase' },
      { name: 'gift_card_id', value: data.giftCardId },
    ],
  });
}

export interface GiftCardDeliveryEmailData {
  giftCardId: string;
  recipientName: string;
  purchaserName: string;
  /** Pre-formatted card value, e.g. "CHF 100.00". */
  amount: string;
  message?: string | null;
  /** Display code (grouped). */
  code: string;
  /** Public gift page /bon/[code]. */
  giftUrl: string;
  expiryDate: string;
  /** Personalised PDF, attached to the email. */
  pdf: Buffer;
}

/** Email #7 — recipient delivery, on the chosen date (P-09 / L-083). */
export async function sendGiftCardDeliveryEmail(
  email: string,
  data: GiftCardDeliveryEmailData,
  locale?: Locale | null
): Promise<SendEmailResult> {
  const loc = getLocale(locale);
  const html = await render(
    GiftCardDeliveryEmail({
      locale: loc,
      recipientName: data.recipientName,
      purchaserName: data.purchaserName,
      amount: data.amount,
      message: data.message,
      code: data.code,
      giftUrl: data.giftUrl,
      expiryDate: data.expiryDate,
    })
  );

  return sendEmailDetailed({
    to: email,
    subject: t(subjects.giftCardDelivery, loc).replace(
      '{purchaserName}',
      data.purchaserName
    ),
    html,
    attachments: [
      {
        filename: 'bon-cadeau-encave.pdf',
        content: data.pdf.toString('base64'),
        contentType: 'application/pdf',
      },
    ],
    tags: [
      { name: 'email_type', value: 'gift_card_delivery' },
      { name: 'gift_card_id', value: data.giftCardId },
    ],
  });
}

// Sur-mesure request emails (P-10 / US-240)

export interface RequestSubmittedEmailData {
  clientName: string;
  wineryName: string;
  guestCount: number;
  desiredDate: Date | null;
  requestReference: string;
}

/** Email #8 — acknowledgement to the client (locale = Request.locale). */
export async function sendRequestSubmittedEmail(
  email: string,
  data: RequestSubmittedEmailData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const routingLocale = loc.toLowerCase() as RoutingLocale;
  const html = await render(
    RequestSubmittedEmail({
      locale: loc,
      clientName: data.clientName,
      wineryName: data.wineryName,
      guestCount: data.guestCount,
      desiredDate: data.desiredDate
        ? formatDate(data.desiredDate, routingLocale)
        : null,
      requestReference: data.requestReference,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.requestSubmitted, loc).replace(
      '{wineryName}',
      data.wineryName
    ),
    html,
    tags: [{ name: 'email_type', value: 'request_submitted' }],
  });
}

export interface RequestNewCustomEmailData {
  wineryId: string;
  winemakerName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  guestCount: number;
  desiredDate: Date | null;
  budgetCents: number | null;
  description: string;
  requestReference: string;
  inboxUrl: string;
}

/** Email #15 — new sur-mesure request to the winery (winemaker locale). */
export async function sendRequestNewCustomEmail(
  email: string,
  data: RequestNewCustomEmailData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const routingLocale = loc.toLowerCase() as RoutingLocale;
  const html = await render(
    RequestNewCustomEmail({
      locale: loc,
      winemakerName: data.winemakerName,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      guestCount: data.guestCount,
      desiredDate: data.desiredDate
        ? formatDate(data.desiredDate, routingLocale)
        : null,
      budget: data.budgetCents !== null ? formatCHF(data.budgetCents) : null,
      description: data.description,
      requestReference: data.requestReference,
      inboxUrl: data.inboxUrl,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.requestNewCustom, loc).replace(
      '{clientName}',
      data.clientName
    ),
    html,
    tags: [
      { name: 'email_type', value: 'request_new_custom' },
      { name: 'winery_id', value: data.wineryId },
    ],
  });
}

export interface RequestOfferReceivedEmailData {
  clientName: string;
  wineryName: string;
  message: string;
  totalPriceCents: number;
  scheduledDate: Date;
  scheduledStartTime: string; // "HH:mm"
  guestCount: number;
  expiresAt: Date;
  payUrl: string;
}

/** Email #9 — the winery's offer, ready to pay (locale = Request.locale). */
export async function sendRequestOfferReceivedEmail(
  email: string,
  data: RequestOfferReceivedEmailData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const routingLocale = loc.toLowerCase() as RoutingLocale;
  const html = await render(
    RequestOfferReceivedEmail({
      locale: loc,
      clientName: data.clientName,
      wineryName: data.wineryName,
      message: data.message,
      total: formatCHF(data.totalPriceCents),
      eventDate: formatDate(data.scheduledDate, routingLocale),
      eventTime: data.scheduledStartTime,
      guestCount: data.guestCount,
      expiry: formatDate(data.expiresAt, routingLocale),
      payUrl: data.payUrl,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.requestOfferReceived, loc).replace(
      '{wineryName}',
      data.wineryName
    ),
    html,
    tags: [{ name: 'email_type', value: 'request_offer_received' }],
  });
}

export interface RequestOfferExpiringEmailData {
  clientName: string;
  wineryName: string;
  totalPriceCents: number;
  expiresAt: Date;
  payUrl: string;
}

/** Email #10 — single reminder before the offer expires (Request.locale). */
export async function sendRequestOfferExpiringEmail(
  email: string,
  data: RequestOfferExpiringEmailData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const routingLocale = loc.toLowerCase() as RoutingLocale;
  const html = await render(
    RequestOfferExpiringEmail({
      locale: loc,
      clientName: data.clientName,
      wineryName: data.wineryName,
      total: formatCHF(data.totalPriceCents),
      expiry: formatDate(data.expiresAt, routingLocale),
      payUrl: data.payUrl,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.requestOfferExpiring, loc).replace(
      '{wineryName}',
      data.wineryName
    ),
    html,
    tags: [{ name: 'email_type', value: 'request_offer_expiring' }],
  });
}

export interface RequestSlaEscalationEmailData {
  wineryName: string;
  clientName: string;
  clientEmail: string;
  requestReference: string;
  guestCount: number;
  createdAt: Date;
  inboxUrl: string;
}

/** Escalation — 48h no-answer, to the admin (locale FR fixe). */
export async function sendRequestSlaEscalationEmail(
  email: string,
  data: RequestSlaEscalationEmailData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const routingLocale = loc.toLowerCase() as RoutingLocale;
  const html = await render(
    RequestSlaEscalationEmail({
      locale: loc,
      wineryName: data.wineryName,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      requestReference: data.requestReference,
      guestCount: data.guestCount,
      createdAt: formatDate(data.createdAt, routingLocale),
      inboxUrl: data.inboxUrl,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.requestSlaEscalation, loc).replace(
      '{wineryName}',
      data.wineryName
    ),
    html,
    tags: [{ name: 'email_type', value: 'request_sla_escalation' }],
  });
}

// Contact form (P-12 / L-114)

/** Internal inbox that receives contact-form messages. */
const CONTACT_INBOX = 'samuel@encave.ch';

export interface ContactMessageData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Contact form (P-12 / L-114): notify the team (reply-to the sender) and send
 * the sender a short accusé. Returns whether the TEAM notification went out —
 * that is the deliverable; a failed accusé is logged, never fatal.
 */
export async function sendContactMessageEmail(
  data: ContactMessageData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);

  const teamHtml = await render(
    ContactMessageEmail({
      locale: loc,
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
    })
  );
  const teamOk = await sendEmail({
    to: CONTACT_INBOX,
    replyTo: data.email,
    subject: t(subjects.contactMessage, loc).replace('{name}', data.name),
    html: teamHtml,
    tags: [{ name: 'email_type', value: 'contact_message' }],
  });

  // Client accusé — best effort, never blocks the success path.
  try {
    const ackHtml = await render(
      ContactAckEmail({ locale: loc, name: data.name, message: data.message })
    );
    const ackOk = await sendEmail({
      to: data.email,
      subject: t(subjects.contactAck, loc),
      html: ackHtml,
      tags: [{ name: 'email_type', value: 'contact_ack' }],
    });
    if (!ackOk) {
      logWarn('contact accusé email failed', { to: data.email });
    }
  } catch (error) {
    logError('contact accusé render/send failed', error, { to: data.email });
  }

  return teamOk;
}
