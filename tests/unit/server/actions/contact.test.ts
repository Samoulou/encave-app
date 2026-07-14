import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/server/services/rate-limit.service', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
  getClientIp: vi.fn(() => 'test-ip'),
  CONTACT_RATE_LIMIT: { maxRequests: 5, windowMs: 1000 },
}));
vi.mock('@/server/services/email.service', () => ({
  sendContactMessageEmail: vi.fn(async () => true),
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { checkRateLimit } = await import('@/server/services/rate-limit.service');
const { sendContactMessageEmail } =
  await import('@/server/services/email.service');
const { sendContactMessageAction } = await import('@/server/actions/contact');

const validInput = {
  name: 'Jane Doe',
  email: 'jane@example.ch',
  subject: 'Question sur une dégustation',
  message: 'Bonjour, avez-vous des créneaux le week-end ?',
  locale: 'fr' as const,
};

describe('sendContactMessageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({ success: true } as never);
    vi.mocked(sendContactMessageEmail).mockResolvedValue(true);
  });

  it('sends the message on valid input (happy path)', async () => {
    const result = await sendContactMessageAction(validInput);
    expect(result.success).toBe(true);
    expect(sendContactMessageEmail).toHaveBeenCalledTimes(1);
  });

  it('returns VALIDATION_ERROR on invalid input', async () => {
    const result = await sendContactMessageAction({
      ...validInput,
      email: 'not-an-email',
      message: 'too short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(sendContactMessageEmail).not.toHaveBeenCalled();
  });

  it('returns RATE_LIMITED when the limiter rejects', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ success: false } as never);
    const result = await sendContactMessageAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('RATE_LIMITED');
    }
    expect(sendContactMessageEmail).not.toHaveBeenCalled();
  });

  it('silently accepts a filled honeypot without sending', async () => {
    const result = await sendContactMessageAction({
      ...validInput,
      website: 'http://spam.example',
    });
    expect(result.success).toBe(true);
    expect(sendContactMessageEmail).not.toHaveBeenCalled();
  });

  it('returns INTERNAL_ERROR when the email fails', async () => {
    vi.mocked(sendContactMessageEmail).mockResolvedValue(false);
    const result = await sendContactMessageAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });
});
