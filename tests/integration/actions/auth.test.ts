import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}));

// Mock better-auth with inline mock
const mockSignOut = vi.hoisted(() => vi.fn());
vi.mock('@/server/better-auth', () => ({
  auth: {
    api: {
      signOut: mockSignOut,
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import { logoutAction } from '@/server/actions/auth';

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logoutAction', () => {
    it('calls betterAuth signOut with headers', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);

      await logoutAction();

      expect(mockSignOut).toHaveBeenCalledWith({
        headers: expect.any(Headers),
      });
    });

    it('does not throw when signOut fails', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('Session expired'));

      await expect(logoutAction()).resolves.toBeUndefined();
    });

    it('logs error when signOut fails', async () => {
      const { logError } = await import('@/lib/logger');
      const error = new Error('Network error');
      mockSignOut.mockRejectedValueOnce(error);

      await logoutAction();

      expect(logError).toHaveBeenCalledWith('Logout error', error, {
        action: 'logoutAction',
      });
    });
  });
});
