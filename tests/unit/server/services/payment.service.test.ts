import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    BETTER_AUTH_URL: 'https://test.example.com',
    PLATFORM_COMMISSION_RATE: 0.12,
  },
  getBaseUrl: () => 'https://test.example.com',
}));

// Create mock Stripe methods
const mockAccountsCreate = vi.fn();
const mockAccountsRetrieve = vi.fn();
const mockAccountsCreateLoginLink = vi.fn();
const mockAccountLinksCreate = vi.fn();
const mockCheckoutSessionsRetrieve = vi.fn();
const mockRefundsCreate = vi.fn();

// Mock Stripe constructor
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    accounts: {
      create: mockAccountsCreate,
      retrieve: mockAccountsRetrieve,
      createLoginLink: mockAccountsCreateLoginLink,
    },
    accountLinks: {
      create: mockAccountLinksCreate,
    },
    checkout: {
      sessions: {
        retrieve: mockCheckoutSessionsRetrieve,
      },
    },
    refunds: {
      create: mockRefundsCreate,
    },
  })),
}));

import { db } from '@/server/db';

// Import service functions after mocks
const {
  createConnectAccount,
  getStripeLoginLink,
  getStripeAccountStatus,
  syncStripeAccountStatus,
  canPublishExperiences,
  getPlatformCommissionRate,
  processRefund,
} = await import('@/server/services/payment.service');

const mockDb = vi.mocked(db);

describe('Payment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createConnectAccount', () => {
    const mockWinery = {
      id: 'winery-123',
      name: 'Test Winery',
      email: 'winemaker@test.com',
      stripeAccountId: null,
      user: { id: 'user-123', email: 'winemaker@test.com' },
    };

    it('throws error when winery not found', async () => {
      mockDb.winery.findUnique.mockResolvedValue(null);

      await expect(createConnectAccount('non-existent')).rejects.toThrow(
        'Winery not found'
      );
    });

    it('creates new Stripe account for winery without existing account', async () => {
      mockDb.winery.findUnique.mockResolvedValue(mockWinery as never);
      mockAccountsCreate.mockResolvedValue({ id: 'acct_new123' });
      mockDb.winery.update.mockResolvedValue({} as never);
      mockAccountLinksCreate.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/s/abc123',
      });

      const result = await createConnectAccount('winery-123');

      expect(result).toBe('https://connect.stripe.com/setup/s/abc123');
      expect(mockAccountsCreate).toHaveBeenCalledWith({
        type: 'express',
        country: 'CH',
        email: 'winemaker@test.com',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          wineryId: 'winery-123',
          wineryName: 'Test Winery',
        },
      });
      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { id: 'winery-123' },
        data: { stripeAccountId: 'acct_new123' },
      });
    });

    it('creates onboarding link for existing Stripe account', async () => {
      const wineryWithStripe = {
        ...mockWinery,
        stripeAccountId: 'acct_existing',
      };
      mockDb.winery.findUnique.mockResolvedValue(wineryWithStripe as never);
      mockAccountLinksCreate.mockResolvedValue({
        url: 'https://connect.stripe.com/setup/s/existing',
      });

      const result = await createConnectAccount('winery-123');

      expect(result).toBe('https://connect.stripe.com/setup/s/existing');
      expect(mockAccountsCreate).not.toHaveBeenCalled();
      expect(mockAccountLinksCreate).toHaveBeenCalledWith({
        account: 'acct_existing',
        refresh_url:
          'https://test.example.com/dashboard/stripe/callback?refresh=true',
        return_url:
          'https://test.example.com/dashboard/stripe/callback?success=true',
        type: 'account_onboarding',
      });
    });
  });

  describe('getStripeLoginLink', () => {
    it('returns login link URL', async () => {
      mockAccountsCreateLoginLink.mockResolvedValue({
        url: 'https://dashboard.stripe.com/express/acct_123',
      });

      const result = await getStripeLoginLink('acct_123');

      expect(result).toBe('https://dashboard.stripe.com/express/acct_123');
      expect(mockAccountsCreateLoginLink).toHaveBeenCalledWith('acct_123');
    });
  });

  describe('getStripeAccountStatus', () => {
    it('returns account status with all fields', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        charges_enabled: true,
        details_submitted: true,
        payouts_enabled: true,
        requirements: {
          currently_due: [],
          errors: [],
        },
      });

      const result = await getStripeAccountStatus('acct_123');

      expect(result).toEqual({
        chargesEnabled: true,
        detailsSubmitted: true,
        payoutsEnabled: true,
        requiresAction: false,
        requirements: {
          currently_due: [],
          errors: [],
        },
      });
    });

    it('detects when account requires action', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        charges_enabled: false,
        details_submitted: true,
        payouts_enabled: false,
        requirements: {
          currently_due: ['individual.verification.document'],
          errors: [],
        },
      });

      const result = await getStripeAccountStatus('acct_123');

      expect(result.requiresAction).toBe(true);
    });

    it('detects when account has errors', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        charges_enabled: false,
        details_submitted: true,
        payouts_enabled: false,
        requirements: {
          currently_due: [],
          errors: [{ code: 'invalid_address' }],
        },
      });

      const result = await getStripeAccountStatus('acct_123');

      expect(result.requiresAction).toBe(true);
    });

    it('handles null requirements gracefully', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        charges_enabled: true,
        details_submitted: true,
        payouts_enabled: true,
        requirements: null,
      });

      const result = await getStripeAccountStatus('acct_123');

      expect(result.requiresAction).toBe(false);
      expect(result.requirements).toBeNull();
    });
  });

  describe('syncStripeAccountStatus', () => {
    it('updates winery with current Stripe status', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        charges_enabled: true,
        details_submitted: true,
        payouts_enabled: true,
        requirements: null,
      });
      mockDb.winery.update.mockResolvedValue({} as never);

      await syncStripeAccountStatus('acct_123');

      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_123' },
        data: {
          stripeOnboardingComplete: true,
          stripeDetailsSubmitted: true,
        },
      });
    });

    it('updates winery with partial status', async () => {
      mockAccountsRetrieve.mockResolvedValue({
        charges_enabled: false,
        details_submitted: true,
        payouts_enabled: false,
        requirements: { currently_due: ['document'] },
      });
      mockDb.winery.update.mockResolvedValue({} as never);

      await syncStripeAccountStatus('acct_456');

      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_456' },
        data: {
          stripeOnboardingComplete: false,
          stripeDetailsSubmitted: true,
        },
      });
    });
  });

  describe('canPublishExperiences', () => {
    it('returns false when winery not found', async () => {
      mockDb.winery.findUnique.mockResolvedValue(null);

      const result = await canPublishExperiences('non-existent');

      expect(result).toEqual({
        canPublish: false,
        reason: 'Winery not found',
      });
    });

    it('returns false when winery not verified', async () => {
      mockDb.winery.findUnique.mockResolvedValue({
        status: 'PENDING',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      } as never);

      const result = await canPublishExperiences('winery-123');

      expect(result).toEqual({
        canPublish: false,
        reason: 'Winery not verified',
      });
    });

    it('returns false when Stripe not connected', async () => {
      mockDb.winery.findUnique.mockResolvedValue({
        status: 'VERIFIED',
        stripeAccountId: null,
        stripeOnboardingComplete: false,
      } as never);

      const result = await canPublishExperiences('winery-123');

      expect(result).toEqual({
        canPublish: false,
        reason:
          'Payment setup required. Connect your Stripe account to publish.',
      });
    });

    it('returns false when Stripe onboarding incomplete', async () => {
      mockDb.winery.findUnique.mockResolvedValue({
        status: 'VERIFIED',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: false,
      } as never);

      const result = await canPublishExperiences('winery-123');

      expect(result).toEqual({
        canPublish: false,
        reason: 'Complete Stripe onboarding to publish experiences.',
      });
    });

    it('returns true when all requirements met', async () => {
      mockDb.winery.findUnique.mockResolvedValue({
        status: 'VERIFIED',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      } as never);

      const result = await canPublishExperiences('winery-123');

      expect(result).toEqual({
        canPublish: true,
      });
    });
  });

  describe('getPlatformCommissionRate', () => {
    it('returns the configured commission rate', () => {
      const result = getPlatformCommissionRate();

      expect(result).toBe(0.12);
    });
  });

  describe('processRefund', () => {
    it('processes full refund with application fee', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        payment_intent: 'pi_test456',
      });
      mockRefundsCreate.mockResolvedValue({
        id: 're_test789',
        amount: 20000,
        status: 'succeeded',
      });

      const result = await processRefund('cs_test123', true);

      expect(result).toEqual({
        refundId: 're_test789',
        amount: 20000,
      });
      expect(mockCheckoutSessionsRetrieve).toHaveBeenCalledWith('cs_test123');
      expect(mockRefundsCreate).toHaveBeenCalledWith({
        payment_intent: 'pi_test456',
        reverse_transfer: true,
        refund_application_fee: true,
      });
    });

    it('processes refund directly from a payment intent ID', async () => {
      mockRefundsCreate.mockResolvedValue({
        id: 're_test789',
        amount: 20000,
        status: 'succeeded',
      });

      const result = await processRefund('pi_test456', true);

      expect(result).toEqual({
        refundId: 're_test789',
        amount: 20000,
      });
      expect(mockCheckoutSessionsRetrieve).not.toHaveBeenCalled();
      expect(mockRefundsCreate).toHaveBeenCalledWith({
        payment_intent: 'pi_test456',
        reverse_transfer: true,
        refund_application_fee: true,
      });
    });

    it('processes refund without application fee refund', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        payment_intent: 'pi_test456',
      });
      mockRefundsCreate.mockResolvedValue({
        id: 're_test789',
        amount: 20000,
      });

      await processRefund('cs_test123', false);

      expect(mockRefundsCreate).toHaveBeenCalledWith({
        payment_intent: 'pi_test456',
        reverse_transfer: true,
        refund_application_fee: false,
      });
    });

    it('defaults to refunding application fee', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        payment_intent: 'pi_test456',
      });
      mockRefundsCreate.mockResolvedValue({
        id: 're_test789',
        amount: 20000,
      });

      await processRefund('cs_test123');

      expect(mockRefundsCreate).toHaveBeenCalledWith({
        payment_intent: 'pi_test456',
        reverse_transfer: true,
        refund_application_fee: true,
      });
    });

    it('throws error when session has no payment intent', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        payment_intent: null,
      });

      await expect(processRefund('cs_test123')).rejects.toThrow(
        'No payment intent found for this session'
      );
    });

    it('throws error when payment intent is not a string', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        payment_intent: { id: 'pi_expanded' }, // Expanded object instead of string
      });

      await expect(processRefund('cs_test123')).rejects.toThrow(
        'No payment intent found for this session'
      );
    });

    it('propagates Stripe refund errors', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        payment_intent: 'pi_test456',
      });
      mockRefundsCreate.mockRejectedValue(new Error('Insufficient funds'));

      await expect(processRefund('cs_test123')).rejects.toThrow(
        'Insufficient funds'
      );
    });

    it('propagates Stripe session retrieve errors', async () => {
      mockCheckoutSessionsRetrieve.mockRejectedValue(
        new Error('Session not found')
      );

      await expect(processRefund('cs_invalid')).rejects.toThrow(
        'Session not found'
      );
    });

    it('rejects unsupported Stripe identifiers', async () => {
      await expect(processRefund('ch_invalid')).rejects.toThrow(
        'Invalid Stripe payment intent ID'
      );
    });
  });
});
