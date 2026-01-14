import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

// Mock the db module
vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock env with webhook secret
vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_test_mock',
  },
}));

// Mock logger
const mockLogInfo = vi.fn();
const mockLogWarn = vi.fn();
const mockLogError = vi.fn();
vi.mock('@/lib/logger', () => ({
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
}));

// Create a mock Stripe instance
const mockConstructEvent = vi.fn();
const mockStripeInstance = {
  webhooks: {
    constructEvent: mockConstructEvent,
  },
};

// Mock Stripe constructor
vi.mock('stripe', () => ({
  default: vi.fn(() => mockStripeInstance),
}));

import { headers } from 'next/headers';
import { db } from '@/server/db';

// Import the route handler after mocks
const { POST } = await import(
  '@/app/api/webhooks/stripe/connect/route'
);

const mockHeaders = vi.mocked(headers);
const mockDb = vi.mocked(db);

describe('Stripe Connect Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogInfo.mockClear();
    mockLogWarn.mockClear();
    mockLogError.mockClear();
  });

  function createMockRequest(body: string, signature: string | null): Request {
    return {
      text: vi.fn().mockResolvedValue(body),
      headers: {
        get: vi.fn((name: string) =>
          name === 'stripe-signature' ? signature : null
        ),
      },
    } as unknown as Request;
  }

  function createMockHeaders(signature: string | null) {
    return {
      get: vi.fn((name: string) =>
        name === 'stripe-signature' ? signature : null
      ),
    };
  }

  it('returns 400 when signature is missing', async () => {
    const req = createMockRequest('{}', null);
    mockHeaders.mockResolvedValue(createMockHeaders(null) as never);

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('signature');
  });

  it('returns 400 when signature verification fails', async () => {
    const req = createMockRequest('{}', 'invalid_signature');
    mockHeaders.mockResolvedValue(
      createMockHeaders('invalid_signature') as never
    );
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Webhook Error');
  });

  describe('account.updated event', () => {
    const mockAccountUpdatedEvent: Partial<Stripe.Event> = {
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_123',
          details_submitted: true,
          charges_enabled: true,
        } as Stripe.Account,
      },
    };

    it('updates winery status when account is found', async () => {
      const req = createMockRequest('{}', 'valid_signature');
      mockHeaders.mockResolvedValue(
        createMockHeaders('valid_signature') as never
      );
      mockConstructEvent.mockReturnValue(mockAccountUpdatedEvent);
      mockDb.winery.findUnique.mockResolvedValue({
        id: 'winery-123',
      } as never);
      mockDb.winery.update.mockResolvedValue({} as never);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_123' },
        data: {
          stripeDetailsSubmitted: true,
          stripeOnboardingComplete: true,
        },
      });
    });

    it('logs warning when winery not found for account', async () => {
      const req = createMockRequest('{}', 'valid_signature');
      mockHeaders.mockResolvedValue(
        createMockHeaders('valid_signature') as never
      );
      mockConstructEvent.mockReturnValue(mockAccountUpdatedEvent);
      mockDb.winery.findUnique.mockResolvedValue(null);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockDb.winery.update).not.toHaveBeenCalled();
      expect(mockLogWarn).toHaveBeenCalledWith(
        expect.stringContaining('No winery found'),
        expect.any(Object)
      );
    });

    it('handles partial onboarding correctly', async () => {
      const partialEvent: Partial<Stripe.Event> = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_456',
            details_submitted: true,
            charges_enabled: false, // Not yet enabled
          } as Stripe.Account,
        },
      };

      const req = createMockRequest('{}', 'valid_signature');
      mockHeaders.mockResolvedValue(
        createMockHeaders('valid_signature') as never
      );
      mockConstructEvent.mockReturnValue(partialEvent);
      mockDb.winery.findUnique.mockResolvedValue({
        id: 'winery-123',
      } as never);
      mockDb.winery.update.mockResolvedValue({} as never);

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_456' },
        data: {
          stripeDetailsSubmitted: true,
          stripeOnboardingComplete: false,
        },
      });
    });
  });

  describe('account.application.deauthorized event', () => {
    const mockDeauthorizedEvent: Partial<Stripe.Event> = {
      type: 'account.application.deauthorized',
      account: 'acct_789',
      data: {
        object: {} as Stripe.Application,
      },
    };

    it('resets winery Stripe fields on deauthorization', async () => {
      const req = createMockRequest('{}', 'valid_signature');
      mockHeaders.mockResolvedValue(
        createMockHeaders('valid_signature') as never
      );
      mockConstructEvent.mockReturnValue(mockDeauthorizedEvent);
      mockDb.winery.findUnique.mockResolvedValue({
        id: 'winery-123',
      } as never);
      mockDb.winery.update.mockResolvedValue({} as never);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { stripeAccountId: 'acct_789' },
        data: {
          stripeAccountId: null,
          stripeDetailsSubmitted: false,
          stripeOnboardingComplete: false,
        },
      });
    });

    it('handles deauthorization for non-existent winery gracefully', async () => {
      const req = createMockRequest('{}', 'valid_signature');
      mockHeaders.mockResolvedValue(
        createMockHeaders('valid_signature') as never
      );
      mockConstructEvent.mockReturnValue(mockDeauthorizedEvent);
      mockDb.winery.findUnique.mockResolvedValue(null);

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockDb.winery.update).not.toHaveBeenCalled();
    });
  });

  describe('unhandled events', () => {
    it('returns success for unhandled event types', async () => {
      const unhandledEvent: Partial<Stripe.Event> = {
        type: 'payment_intent.created',
        data: {
          object: {} as Stripe.PaymentIntent,
        },
      };

      const req = createMockRequest('{}', 'valid_signature');
      mockHeaders.mockResolvedValue(
        createMockHeaders('valid_signature') as never
      );
      mockConstructEvent.mockReturnValue(unhandledEvent);

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockLogInfo).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled event type'),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('returns 500 when database update fails', async () => {
      const mockEvent: Partial<Stripe.Event> = {
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_error',
            details_submitted: true,
            charges_enabled: true,
          } as Stripe.Account,
        },
      };

      const req = createMockRequest('{}', 'valid_signature');
      mockHeaders.mockResolvedValue(
        createMockHeaders('valid_signature') as never
      );
      mockConstructEvent.mockReturnValue(mockEvent);
      mockDb.winery.findUnique.mockResolvedValue({
        id: 'winery-123',
      } as never);
      mockDb.winery.update.mockRejectedValue(new Error('Database error'));

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Webhook handler failed');
      expect(mockLogError).toHaveBeenCalled();
    });
  });
});
