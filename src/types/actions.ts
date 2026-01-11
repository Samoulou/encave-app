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
  | 'INTERNAL_ERROR';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };
