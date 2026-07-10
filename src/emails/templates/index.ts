// Booking emails
export { BookingConfirmationEmail } from './BookingConfirmationEmail';
export type { BookingConfirmationEmailProps } from './BookingConfirmationEmail';

export { BookingExpiredEmail } from './BookingExpiredEmail';
export { BookingCancelledByWineryEmail } from './BookingCancelledByWineryEmail';
export {
  ManualRefundClientEmail,
  ManualRefundWinemakerEmail,
} from './ManualRefundEmail';
export { AccountDeletedEmail } from './AccountDeletedEmail';

export { BookingReminderEmail } from './BookingReminderEmail';
export type { BookingReminderEmailProps } from './BookingReminderEmail';

export { BookingCancellationEmail } from './BookingCancellationEmail';
export type { BookingCancellationEmailProps } from './BookingCancellationEmail';

// Authentication emails
export { PasswordResetEmail } from './PasswordResetEmail';
export type { PasswordResetEmailProps } from './PasswordResetEmail';

export { WelcomeEmail } from './WelcomeEmail';
export type { WelcomeEmailProps } from './WelcomeEmail';

export { EmailVerificationEmail } from './EmailVerificationEmail';
export type { EmailVerificationEmailProps } from './EmailVerificationEmail';

// Winemaker notification emails
export { WinemakerNewBookingEmail } from './WinemakerNewBookingEmail';
export type { WinemakerNewBookingEmailProps } from './WinemakerNewBookingEmail';

export { WinemakerCancellationEmail } from './WinemakerCancellationEmail';
export type { WinemakerCancellationEmailProps } from './WinemakerCancellationEmail';

// Winery verification emails
export { WineryApprovedEmail } from './WineryApprovedEmail';
export type { WineryApprovedEmailProps } from './WineryApprovedEmail';

export { WineryRejectedEmail } from './WineryRejectedEmail';
export type { WineryRejectedEmailProps } from './WineryRejectedEmail';

// Automated notification emails
export { ClientReminder2hEmail } from './ClientReminder2hEmail';
export type { ClientReminder2hEmailProps } from './ClientReminder2hEmail';

export { DailyDigestEmail } from './DailyDigestEmail';
export type {
  DailyDigestEmailProps,
  DailyDigestBooking,
} from './DailyDigestEmail';

export { PostExperienceFollowUpEmail } from './PostExperienceFollowUpEmail';
export type { PostExperienceFollowUpEmailProps } from './PostExperienceFollowUpEmail';

export { WeeklySummaryEmail } from './WeeklySummaryEmail';
export type {
  WeeklySummaryEmailProps,
  WeeklySummaryStats,
} from './WeeklySummaryEmail';

export { TastingRecapEmail } from './TastingRecapEmail';
export type { TastingRecapWine } from './TastingRecapEmail';
