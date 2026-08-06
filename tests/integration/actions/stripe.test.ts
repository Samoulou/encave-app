import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@/server/auth';

// Mock the auth module
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock the db module
vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock the payment service
vi.mock('@/server/services/payment.service', () => ({
  createConnectAccount: vi.fn(),
  getStripeLoginLink: vi.fn(),
}));

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
  },
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  createConnectAccount,
  getStripeLoginLink,
} from '@/server/services/payment.service';

// Import actions after mocks
const { startStripeOnboarding, getStripeDashboardLink } =
  await import('@/server/actions/stripe');

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);
const mockCreateConnectAccount = vi.mocked(createConnectAccount);
const mockGetStripeLoginLink = vi.mocked(getStripeLoginLink);

describe('Stripe Server Actions', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'winemaker@test.com',
      name: 'Winemaker',
      role: 'WINEMAKER',
      preferredLocale: 'FR',
    },
  };

  const mockWinery = {
    id: 'winery-123',
    userId: 'user-123',
    name: 'Test Winery',
    status: 'VERIFIED' as const,
    stripeAccountId: null,
    stripeOnboardingComplete: false,
    stripeDetailsSubmitted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startStripeOnboarding', () => {
    it('returns UNAUTHORIZED when user is not logged in', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await startStripeOnboarding('winery-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery does not exist', async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockDb.winery.findUnique.mockResolvedValue(null);

      const result = await startStripeOnboarding('non-existent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when user does not own the winery', async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockDb.winery.findUnique.mockResolvedValue({
        userId: 'other-user',
        status: 'VERIFIED',
      } as never);

      const result = await startStripeOnboarding('winery-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns FORBIDDEN when winery is not verified', async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockDb.winery.findUnique.mockResolvedValue({
        userId: 'user-123',
        status: 'PENDING',
      } as never);

      const result = await startStripeOnboarding('winery-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
        expect(result.error.message).toContain('verified');
      }
    });

    it('returns onboarding URL on success', async () => {
      const onboardingUrl = 'https://connect.stripe.com/setup/s/abc123';
      mockAuth.mockResolvedValue(mockSession);
      mockDb.winery.findUnique.mockResolvedValue({
        userId: 'user-123',
        status: 'VERIFIED',
      } as never);
      mockCreateConnectAccount.mockResolvedValue(onboardingUrl);

      const result = await startStripeOnboarding('winery-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(onboardingUrl);
      }
      expect(mockCreateConnectAccount).toHaveBeenCalledWith('winery-123');
    });

    it('returns STRIPE_ERROR when Stripe API fails', async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockDb.winery.findUnique.mockResolvedValue({
        userId: 'user-123',
        status: 'VERIFIED',
      } as never);
      mockCreateConnectAccount.mockRejectedValue(new Error('Stripe API error'));

      const result = await startStripeOnboarding('winery-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('STRIPE_ERROR');
      }
    });
  });

  describe('getStripeDashboardLink', () => {
    it('returns UNAUTHORIZED when user is not logged in', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await getStripeDashboardLink();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery has no Stripe account', async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockDb.winery.findUnique.mockResolvedValue({
        stripeAccountId: null,
      } as never);

      const result = await getStripeDashboardLink();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns dashboard URL on success', async () => {
      const dashboardUrl = 'https://dashboard.stripe.com/express/acct_123';
      mockAuth.mockResolvedValue(mockSession);
      mockDb.winery.findUnique.mockResolvedValue({
        stripeAccountId: 'acct_123',
      } as never);
      mockGetStripeLoginLink.mockResolvedValue(dashboardUrl);

      const result = await getStripeDashboardLink();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(dashboardUrl);
      }
      expect(mockGetStripeLoginLink).toHaveBeenCalledWith('acct_123');
    });

    it('returns STRIPE_ERROR when Stripe API fails', async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockDb.winery.findUnique.mockResolvedValue({
        stripeAccountId: 'acct_123',
      } as never);
      mockGetStripeLoginLink.mockRejectedValue(new Error('Stripe API error'));

      const result = await getStripeDashboardLink();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('STRIPE_ERROR');
      }
    });
  });
});
