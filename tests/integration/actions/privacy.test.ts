import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = vi.fn();
vi.mock('@/server/auth', () => ({
  auth: () => mockAuth(),
}));

const mockAnonymizeUser = vi.fn();
vi.mock('@/server/services/anonymization.service', () => ({
  anonymizeUser: (...args: unknown[]) => mockAnonymizeUser(...args),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { requestAccountDeletion } = await import('@/server/actions/privacy');

describe('requestAccountDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns UNAUTHORIZED without a session', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requestAccountDeletion({ email: 'a@b.ch' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
    expect(mockAnonymizeUser).not.toHaveBeenCalled();
  });

  it('rejects when the confirmation email does not match the session', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'real@encave.ch', emailVerified: true },
    });

    const result = await requestAccountDeletion({ email: 'other@encave.ch' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(mockAnonymizeUser).not.toHaveBeenCalled();
  });

  it('anonymizes the user on matching confirmation', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'real@encave.ch', emailVerified: true },
    });
    mockAnonymizeUser.mockResolvedValue({ alreadyAnonymized: false });

    const result = await requestAccountDeletion({ email: 'real@encave.ch' });

    expect(result.success).toBe(true);
    expect(mockAnonymizeUser).toHaveBeenCalledWith('user-1');
  });

  it('surfaces FUTURE_WINERY_BOOKINGS as a validation error', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'real@encave.ch', emailVerified: true },
    });
    mockAnonymizeUser.mockRejectedValue(new Error('FUTURE_WINERY_BOOKINGS:2'));

    const result = await requestAccountDeletion({ email: 'real@encave.ch' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('FUTURE_WINERY_BOOKINGS');
    }
  });
});
