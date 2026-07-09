import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/logger', () => ({
  logWarn: vi.fn(),
}));

const { withSerializableRetry } =
  await import('@/server/services/serializable-retry.service');

function p2034(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Transaction failed due to a write conflict or a deadlock',
    { code: 'P2034', clientVersion: '5.22.0' }
  );
}

describe('withSerializableRetry (L-209)', () => {
  it('retries a P2034 conflict and returns the eventual result', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(p2034())
      .mockRejectedValueOnce(p2034())
      .mockResolvedValue('ok');

    await expect(withSerializableRetry(fn, 'test')).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after 3 attempts and rethrows the conflict', async () => {
    const fn = vi.fn().mockRejectedValue(p2034());

    await expect(withSerializableRetry(fn, 'test')).rejects.toMatchObject({
      code: 'P2034',
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('propagates non-conflict errors immediately (no retry)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('NO_CAPACITY'));

    await expect(withSerializableRetry(fn, 'test')).rejects.toThrow(
      'NO_CAPACITY'
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
