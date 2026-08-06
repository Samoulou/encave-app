import crypto from 'crypto';

/**
 * sha256 hex — THE token-hash scheme of the platform (SEC-002): booking
 * access tokens, hold tokens, recap tokens. Plaintext is never stored;
 * every lookup goes through this hash.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
