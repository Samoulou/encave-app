/**
 * BACK-007: Structured Logging with Pino
 *
 * Provides structured JSON logging in production and pretty-printed logs in development.
 * Use this instead of console.log/error for all server-side logging.
 */

import pino from 'pino';

// Configure logger based on environment
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;

// In Vercel/production, use JSON logging
// In development, use pino-pretty for readable output
export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  // In Vercel, logs should be JSON for proper parsing
  // In local dev, we can use transport for pretty printing
  ...(isProduction || isVercel
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
});

// Context helpers for common use cases
export interface LogContext {
  userId?: string;
  bookingId?: string;
  experienceId?: string;
  wineryId?: string;
  requestId?: string;
  action?: string;
  [key: string]: unknown;
}

/**
 * Create a child logger with pre-bound context
 */
export function createLogger(context: LogContext) {
  return logger.child(context);
}

/**
 * Log an info message with optional context
 */
export function logInfo(message: string, context?: LogContext) {
  if (context) {
    logger.info(context, message);
  } else {
    logger.info(message);
  }
}

/**
 * Log a warning message with optional context
 */
export function logWarn(message: string, context?: LogContext) {
  if (context) {
    logger.warn(context, message);
  } else {
    logger.warn(message);
  }
}

/**
 * Log an error message with optional context
 */
export function logError(message: string, error?: unknown, context?: LogContext) {
  const errorContext = {
    ...context,
    ...(error instanceof Error
      ? { error: { message: error.message, stack: error.stack, name: error.name } }
      : { error }),
  };
  logger.error(errorContext, message);
}

/**
 * Log a debug message with optional context
 */
export function logDebug(message: string, context?: LogContext) {
  if (context) {
    logger.debug(context, message);
  } else {
    logger.debug(message);
  }
}

export default logger;
