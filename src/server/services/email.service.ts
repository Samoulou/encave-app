import { Resend } from 'resend';
import { render } from '@react-email/components';
import { env, getBaseUrl } from '@/lib/env';
import { logInfo, logError, logWarn } from '@/lib/logger';
import type { Locale } from '@prisma/client';
import {
  BookingConfirmationEmail,
  BookingReminderEmail,
  BookingCancellationEmail,
  BookingCancelledByWineryEmail,
  BookingExpiredEmail,
  ManualRefundClientEmail,
  ManualRefundWinemakerEmail,
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
  attachments?: {
    filename: string;
    content: string;
    contentType?: string;
    cid?: string;
  }[];
}

/**
 * BACK-004 FIX: Send email with exponential backoff retry
 * Retries up to 3 times with delays of 1s, 2s, 4s
 */
async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: SendEmailOptions): Promise<boolean> {
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
      return false;
    }
    logInfo('Resend not configured, skipping email (non-production)', {
      to,
      subject,
    });
    return true;
  }

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        attachments,
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
          return false;
        }
        // Wait before retrying (exponential backoff: 1s, 2s, 4s)
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return true;
    } catch (error) {
      logWarn(`Email attempt ${attempt}/${MAX_RETRY_ATTEMPTS} error`, {
        to,
        subject,
        attempt,
      });
      if (attempt === MAX_RETRY_ATTEMPTS) {
        logError('Email max retries reached', error, { to, subject });
        return false;
      }
      // Wait before retrying
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return false;
}

/**
 * BACK-004 FIX: Non-blocking email sending
 * Fire and forget - logs errors but doesn't block caller
 */
export function sendEmailNonBlocking(options: SendEmailOptions): void {
  sendEmail(options).catch((error) => {
    logError('Non-blocking email send failed', error, {
      to: options.to,
      subject: options.subject,
    });
  });
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
}

export async function sendWeeklySummaryEmail(
  email: string,
  data: WeeklySummaryData,
  locale?: Locale | null
): Promise<boolean> {
  const loc = getLocale(locale);
  const html = await render(
    WeeklySummaryEmail({
      locale: loc,
      ...data,
      dashboardUrl: `${getBaseUrl()}/dashboard/earnings`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.weeklySummary, loc),
    html,
  });
}
