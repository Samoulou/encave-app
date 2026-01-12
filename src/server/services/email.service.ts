import { Resend } from 'resend';
import { render } from '@react-email/components';
import { env } from '@/lib/env';
import type { Locale } from '@prisma/client';
import {
  BookingConfirmationEmail,
  BookingReminderEmail,
  BookingCancellationEmail,
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

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const FROM_EMAIL = 'EnCave <noreply@encave.ch>';
const DEFAULT_LOCALE: Locale = 'FR';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping email:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return false;
  }
}

function getLocale(locale?: Locale | null): Locale {
  return locale ?? DEFAULT_LOCALE;
}

// Booking Emails

export interface BookingConfirmationData {
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
  const html = await render(
    BookingConfirmationEmail({
      locale: loc,
      ...data,
      bookingUrl: `https://encave.ch/bookings/${data.bookingRef}`,
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.bookingConfirmation, loc),
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
      experiencesUrl: 'https://encave.ch/experiences',
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
      experiencesUrl: 'https://encave.ch/experiences',
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
      dashboardUrl: 'https://encave.ch/dashboard/bookings',
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
      dashboardUrl: 'https://encave.ch/dashboard/bookings',
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.wineryCancellation, loc),
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
      dashboardUrl: 'https://encave.ch/dashboard',
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
      dashboardUrl: 'https://encave.ch/dashboard/bookings',
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
      experiencesUrl: 'https://encave.ch/experiences',
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
      dashboardUrl: 'https://encave.ch/dashboard/earnings',
    })
  );

  return sendEmail({
    to: email,
    subject: t(subjects.weeklySummary, loc),
    html,
  });
}
