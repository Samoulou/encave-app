/**
 * better-auth 1.4 → 1.7 upgrade guard: admins enrolled in TOTP BEFORE the
 * upgrade have their secret + backup codes stored in the 1.4 format (bare
 * hex, XChaCha20-Poly1305 keyed by sha256(BETTER_AUTH_SECRET)). 1.7 writes
 * a versioned envelope and only reads the legacy format through
 * `secretConfig.legacySecret`. If that path ever stops working, every
 * already-enrolled admin is locked out of /admin at the next sign-in.
 *
 * The legacy encryptor below is the 1.4.17 implementation, verbatim
 * (dist/crypto/index.mjs).
 */
import { describe, it, expect, vi } from 'vitest';
import { createHash } from '@better-auth/utils/hash';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, managedNonce, utf8ToBytes } from '@noble/ciphers/utils.js';

vi.mock('@/server/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}));

vi.mock('@/server/services/email.service', () => ({
  sendOtpEmail: vi.fn(),
  sendEmailVerificationEmail: vi.fn(),
  sendEmailChangedNoticeEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

const { symmetricDecrypt, symmetricEncrypt } =
  await import('better-auth/crypto');
const { auth } = await import('@/server/better-auth');

async function legacyEncrypt(key: string, data: string): Promise<string> {
  const keyAsBytes = await createHash('SHA-256').digest(key);
  return bytesToHex(
    managedNonce(xchacha20poly1305)(new Uint8Array(keyAsBytes)).encrypt(
      utf8ToBytes(data)
    )
  );
}

describe('TOTP secrets stored by better-auth 1.4 stay readable in 1.7', () => {
  it('decrypts a legacy bare-hex payload with the configured secret', async () => {
    const secret = process.env.BETTER_AUTH_SECRET ?? '';
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const ctx = await auth.$context;

    const legacyCiphertext = await legacyEncrypt(secret, 'JBSWY3DPEHPK3PXP');

    expect(
      await symmetricDecrypt({
        key: ctx.secretConfig,
        data: legacyCiphertext,
      })
    ).toBe('JBSWY3DPEHPK3PXP');
  });

  it('round-trips the new envelope format too', async () => {
    const ctx = await auth.$context;

    const ciphertext = await symmetricEncrypt({
      key: ctx.secretConfig,
      data: 'new-format-secret',
    });

    expect(
      await symmetricDecrypt({ key: ctx.secretConfig, data: ciphertext })
    ).toBe('new-format-secret');
  });
});
