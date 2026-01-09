'use server';

/**
 * Simple in-memory rate limiter for authentication endpoints.
 * For production with multiple instances, integrate with Upstash Redis.
 *
 * This implementation uses a sliding window approach with automatic cleanup.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (works for single instance, use Upstash for distributed)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => rateLimitStore.delete(key));
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address, user ID, or email)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and remaining requests
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Run periodic cleanup
  cleanup();

  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  // Window still active - check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Reset rate limit for an identifier (useful after successful login)
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  rateLimitStore.delete(identifier);
}

// Pre-configured rate limiters for common use cases
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5, // 5 attempts
  windowMs: 15 * 60 * 1000, // per 15 minutes
};

export const REGISTRATION_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3, // 3 registrations
  windowMs: 60 * 60 * 1000, // per hour
};
