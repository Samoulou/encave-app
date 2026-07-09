export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'STRIPE_ERROR'
  | 'STRIPE_NOT_CONFIGURED'
  | 'STRIPE_NOT_READY'
  | 'NO_CAPACITY'
  | 'OCCURRENCE_CLOSED'
  | 'DATE_BLOCKED'
  | 'INVALID_SLOT'
  | 'FEE_CHANGED'
  | 'WRONG_SESSION'
  | 'PAYMENT_NOT_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'MARKED_NO_SHOW'
  | 'ALREADY_CHECKED_IN'
  | 'PAYMENT_FAILED'
  | 'INTERNAL_ERROR';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };
