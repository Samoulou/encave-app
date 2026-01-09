import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  AUTH_RATE_LIMIT,
  REGISTRATION_RATE_LIMIT,
} from '@/server/services/rate-limit.service';

describe('rate-limit.service', () => {
  beforeEach(() => {
    // Reset the rate limit store by resetting test identifiers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within the limit', async () => {
      const identifier = `test-${Date.now()}`;
      const config = { maxRequests: 3, windowMs: 60000 };

      const result1 = await checkRateLimit(identifier, config);
      expect(result1.success).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = await checkRateLimit(identifier, config);
      expect(result2.success).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = await checkRateLimit(identifier, config);
      expect(result3.success).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests exceeding the limit', async () => {
      const identifier = `test-block-${Date.now()}`;
      const config = { maxRequests: 2, windowMs: 60000 };

      await checkRateLimit(identifier, config);
      await checkRateLimit(identifier, config);

      const result = await checkRateLimit(identifier, config);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const identifier = `test-expire-${Date.now()}`;
      const config = { maxRequests: 1, windowMs: 1000 }; // 1 second window

      const result1 = await checkRateLimit(identifier, config);
      expect(result1.success).toBe(true);

      const result2 = await checkRateLimit(identifier, config);
      expect(result2.success).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(1500);

      const result3 = await checkRateLimit(identifier, config);
      expect(result3.success).toBe(true);
    });

    it('should track different identifiers separately', async () => {
      const identifier1 = `user1-${Date.now()}`;
      const identifier2 = `user2-${Date.now()}`;
      const config = { maxRequests: 1, windowMs: 60000 };

      const result1 = await checkRateLimit(identifier1, config);
      expect(result1.success).toBe(true);

      const result2 = await checkRateLimit(identifier2, config);
      expect(result2.success).toBe(true);

      // identifier1 should be blocked now
      const result3 = await checkRateLimit(identifier1, config);
      expect(result3.success).toBe(false);

      // identifier2 should also be blocked
      const result4 = await checkRateLimit(identifier2, config);
      expect(result4.success).toBe(false);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for an identifier', async () => {
      const identifier = `test-reset-${Date.now()}`;
      const config = { maxRequests: 1, windowMs: 60000 };

      await checkRateLimit(identifier, config);
      const blocked = await checkRateLimit(identifier, config);
      expect(blocked.success).toBe(false);

      await resetRateLimit(identifier);

      const result = await checkRateLimit(identifier, config);
      expect(result.success).toBe(true);
    });
  });

  describe('pre-configured limits', () => {
    it('should have sensible AUTH_RATE_LIMIT defaults', () => {
      expect(AUTH_RATE_LIMIT.maxRequests).toBe(5);
      expect(AUTH_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should have sensible REGISTRATION_RATE_LIMIT defaults', () => {
      expect(REGISTRATION_RATE_LIMIT.maxRequests).toBe(3);
      expect(REGISTRATION_RATE_LIMIT.windowMs).toBe(60 * 60 * 1000); // 1 hour
    });
  });
});
