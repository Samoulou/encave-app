/**
 * Rate limiter service with Upstash Redis support for production.
 * SEC-006: Uses Redis in production for scalability, falls back to in-memory for development.
 *
 * This implementation uses a sliding window approach with automatic cleanup.
 */

import { env } from '@/lib/env';
import { logWarn, logError } from '@/lib/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Check if Redis is configured
const isRedisConfigured = !!(
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
);
const isProduction = env.NODE_ENV === 'production';

// SEC-006: Enforce Redis in production
if (isProduction && !isRedisConfigured) {
  logWarn(
    'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production for scalable rate limiting',
    { action: 'rateLimitInit' }
  );
}

// In-memory store (fallback for development)
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
 * Check rate limit using Upstash Redis
 */
async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Upstash REST API for atomic operations
    const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        // Remove expired entries
        ['ZREMRANGEBYSCORE', key, '0', windowStart.toString()],
        // Add current request
        ['ZADD', key, now.toString(), `${now}-${Math.random()}`],
        // Count requests in window
        ['ZCOUNT', key, windowStart.toString(), now.toString()],
        // Set expiry on the key
        ['PEXPIRE', key, config.windowMs.toString()],
      ]),
    });

    if (!response.ok) {
      throw new Error(`Redis request failed: ${response.status}`);
    }

    const results = await response.json();
    const count = results[2]?.result ?? 1;
    const resetAt = now + config.windowMs;

    if (count > config.maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetAt,
      };
    }

    return {
      success: true,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt,
    };
  } catch (error) {
    logError('Redis error, falling back to in-memory', error, {
      action: 'checkRateLimitRedis',
    });
    // Fallback to in-memory on Redis error
    return checkRateLimitInMemory(identifier, config);
  }
}

/**
 * Check rate limit using in-memory store
 */
function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
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
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address, user ID, or email)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and remaining requests
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Use Redis in production if configured
  if (isRedisConfigured) {
    return checkRateLimitRedis(identifier, config);
  }

  // Fallback to in-memory for development
  return checkRateLimitInMemory(identifier, config);
}

/**
 * Reset rate limit for an identifier (useful after successful login)
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  if (isRedisConfigured) {
    try {
      await fetch(`${env.UPSTASH_REDIS_REST_URL}/del/ratelimit:${identifier}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
    } catch (error) {
      logError('Failed to reset rate limit in Redis', error, {
        action: 'resetRateLimit',
      });
    }
  }
  rateLimitStore.delete(identifier);
}

/**
 * Client IP for rate-limit keys, from proxy headers. Single copy — the
 * geocode/newsletter routes and the hold action all key on this; keep
 * the x-real-ip fallback so a proxy that only sets it doesn't collapse
 * every caller into one shared "unknown" bucket.
 */
export function getClientIp(headerList: Headers): string {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headerList.get('x-real-ip')?.trim() || 'unknown';
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

export const GEOCODE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000, // per minute
};

export const BOOKING_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // per hour
};

// Booking holds are unauthenticated and reserve capacity for 10 min —
// keep the per-IP budget tight to bound griefing (P-04 / L-050).
export const HOLD_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 12,
  windowMs: 10 * 60 * 1000, // per 10 minutes
};

export const API_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000, // per minute
};
