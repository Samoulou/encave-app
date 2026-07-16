export * from './templates';
export * from './components';
export * from './utils';
export * from './translations';

// Sur-mesure request emails (P-10 / US-240). Exported here directly so the
// templates barrel stays untouched.
export { RequestSubmittedEmail } from './templates/RequestSubmittedEmail';
export type { RequestSubmittedEmailProps } from './templates/RequestSubmittedEmail';
export { RequestNewCustomEmail } from './templates/RequestNewCustomEmail';
export type { RequestNewCustomEmailProps } from './templates/RequestNewCustomEmail';
export { RequestOfferReceivedEmail } from './templates/RequestOfferReceivedEmail';
export type { RequestOfferReceivedEmailProps } from './templates/RequestOfferReceivedEmail';
export { RequestOfferExpiringEmail } from './templates/RequestOfferExpiringEmail';
export type { RequestOfferExpiringEmailProps } from './templates/RequestOfferExpiringEmail';
export { RequestSlaEscalationEmail } from './templates/RequestSlaEscalationEmail';
export type { RequestSlaEscalationEmailProps } from './templates/RequestSlaEscalationEmail';
// Admin notification #22 (P-15 / L-163).
export { AdminNewWineryToValidateEmail } from './templates/AdminNewWineryToValidateEmail';
export type { AdminNewWineryToValidateEmailProps } from './templates/AdminNewWineryToValidateEmail';
