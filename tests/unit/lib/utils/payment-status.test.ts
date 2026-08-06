import { describe, it, expect } from 'vitest';
import {
  getPaymentStatusType,
  type PaymentStatusType,
} from '@/lib/utils/payment-status';

describe('getPaymentStatusType', () => {
  describe('not_connected status', () => {
    it('returns not_connected when stripeAccountId is null', () => {
      const result = getPaymentStatusType({
        stripeAccountId: null,
        stripeOnboardingComplete: false,
        stripeDetailsSubmitted: false,
      });

      expect(result).toBe('not_connected');
    });

    it('returns not_connected when stripeAccountId is null even with other flags true', () => {
      // Edge case: flags shouldn't be true without an account, but test defensive behavior
      const result = getPaymentStatusType({
        stripeAccountId: null,
        stripeOnboardingComplete: true,
        stripeDetailsSubmitted: true,
      });

      expect(result).toBe('not_connected');
    });

    it('returns not_connected when account exists but no details submitted', () => {
      const result = getPaymentStatusType({
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: false,
        stripeDetailsSubmitted: false,
      });

      expect(result).toBe('not_connected');
    });
  });

  describe('pending status', () => {
    it('returns pending when details submitted but onboarding not complete', () => {
      const result = getPaymentStatusType({
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: false,
        stripeDetailsSubmitted: true,
      });

      expect(result).toBe('pending');
    });
  });

  describe('ready status', () => {
    it('returns ready when onboarding is complete', () => {
      const result = getPaymentStatusType({
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
        stripeDetailsSubmitted: true,
      });

      expect(result).toBe('ready');
    });

    it('returns ready when onboarding complete even if details not submitted flag is inconsistent', () => {
      // Edge case: charges_enabled should imply details_submitted, but test the priority
      const result = getPaymentStatusType({
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
        stripeDetailsSubmitted: false,
      });

      expect(result).toBe('ready');
    });
  });

  describe('type safety', () => {
    it('returns a valid PaymentStatusType', () => {
      const validStatuses: PaymentStatusType[] = [
        'not_connected',
        'pending',
        'ready',
      ];

      const testCases = [
        {
          stripeAccountId: null,
          stripeOnboardingComplete: false,
          stripeDetailsSubmitted: false,
        },
        {
          stripeAccountId: 'acct_123',
          stripeOnboardingComplete: false,
          stripeDetailsSubmitted: true,
        },
        {
          stripeAccountId: 'acct_123',
          stripeOnboardingComplete: true,
          stripeDetailsSubmitted: true,
        },
      ];

      testCases.forEach((testCase) => {
        const result = getPaymentStatusType(testCase);
        expect(validStatuses).toContain(result);
      });
    });
  });
});
