export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };
