import crypto from 'crypto';
import { addDays, differenceInDays } from 'date-fns';
import { db } from '@/server/db';
import { getBaseUrl } from '@/lib/env';

/**
 * Producers and consumers of the tokenised opt-out links — the single place
 * that knows how an unsubscribe URL is built and what it flips.
 *
 *  - WINERY emails (daily digest, weekly summary) → NotificationPreferences,
 *    one row per winery, `/api/unsubscribe/[token]?type=…`.
 *  - CLIENT emails (post-visit follow-up, tasting recap) →
 *    ClientEmailPreference, keyed by lower-cased email (guests have no User
 *    row), `/api/unsubscribe/client/[token]`.
 *
 * The same URL is printed in the email footer AND sent as the
 * List-Unsubscribe header (RFC 8058 one-click), so both routes accept GET
 * (link) and POST (mailbox provider button).
 */

export const WINERY_UNSUBSCRIBE_TYPES = [
  'daily_digest',
  'weekly_summary',
  'marketing',
  'all',
] as const;
export type WineryUnsubscribeType = (typeof WINERY_UNSUBSCRIBE_TYPES)[number];

export function parseWineryUnsubscribeType(
  value: string | null | undefined
): WineryUnsubscribeType {
  return WINERY_UNSUBSCRIBE_TYPES.find((type) => type === value) ?? 'all';
}

/** SEC-004: winery tokens expire. Lifetime of a freshly issued token. */
export const WINERY_TOKEN_VALIDITY_DAYS = 60;
/**
 * Every link we email must stay valid at least this long after the send:
 * below it, the expiry slides forward (same token — the links already in
 * the winemaker's inbox keep working).
 */
export const WINERY_LINK_MIN_VALIDITY_DAYS = 30;

export function generateUnsubscribeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildWineryUnsubscribeUrl(
  token: string,
  type: WineryUnsubscribeType
): string {
  return `${getBaseUrl()}/api/unsubscribe/${token}?type=${type}`;
}

export function buildClientUnsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/unsubscribe/client/${token}`;
}

interface WineryTokenState {
  unsubscribeToken: string;
  unsubscribeTokenExpiresAt: Date | null;
}

/**
 * Tokenised opt-out URL for a winery email, creating the preferences row
 * when the winery never opened its notification settings (no row = every
 * digest enabled, so those wineries DO receive emails and need a link).
 *
 * `known` is the row the caller already loaded (the crons include it) — it
 * saves the read in the common case, where nothing has to be written.
 */
export async function getWineryUnsubscribeUrl(
  wineryId: string,
  type: WineryUnsubscribeType,
  known?: WineryTokenState | null,
  now: Date = new Date()
): Promise<string> {
  const freshExpiry = addDays(now, WINERY_TOKEN_VALIDITY_DAYS);

  let state: WineryTokenState | null = known ?? null;
  if (!state) {
    // upsert, not create: two crons can race on the first email of a winery.
    state = await db.notificationPreferences.upsert({
      where: { wineryId },
      update: {},
      create: { wineryId, unsubscribeTokenExpiresAt: freshExpiry },
      select: { unsubscribeToken: true, unsubscribeTokenExpiresAt: true },
    });
  }

  const expiresAt = state.unsubscribeTokenExpiresAt;
  // null = legacy row without expiry: the route treats it as always valid.
  if (expiresAt === null) {
    return buildWineryUnsubscribeUrl(state.unsubscribeToken, type);
  }

  if (expiresAt <= now) {
    // Expired: the old links are dead anyway — issue a new token.
    const token = generateUnsubscribeToken();
    await db.notificationPreferences.update({
      where: { wineryId },
      data: { unsubscribeToken: token, unsubscribeTokenExpiresAt: freshExpiry },
    });
    return buildWineryUnsubscribeUrl(token, type);
  }

  if (differenceInDays(expiresAt, now) < WINERY_LINK_MIN_VALIDITY_DAYS) {
    await db.notificationPreferences.update({
      where: { wineryId },
      data: { unsubscribeTokenExpiresAt: freshExpiry },
    });
  }
  return buildWineryUnsubscribeUrl(state.unsubscribeToken, type);
}

export type WineryUnsubscribeOutcome = 'success' | 'invalid' | 'expired';

/** Consumer side of the winery link (GET click or one-click POST). */
export async function applyWineryUnsubscribe(
  token: string,
  type: WineryUnsubscribeType,
  now: Date = new Date()
): Promise<WineryUnsubscribeOutcome> {
  const preferences = await db.notificationPreferences.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, unsubscribeTokenExpiresAt: true },
  });
  if (!preferences) {
    return 'invalid';
  }

  // SEC-004: an expired token unsubscribes nobody and is rotated, so a
  // leaked old link cannot be replayed.
  if (
    preferences.unsubscribeTokenExpiresAt &&
    preferences.unsubscribeTokenExpiresAt < now
  ) {
    await db.notificationPreferences.update({
      where: { id: preferences.id },
      data: {
        unsubscribeToken: generateUnsubscribeToken(),
        unsubscribeTokenExpiresAt: addDays(now, WINERY_TOKEN_VALIDITY_DAYS),
      },
    });
    return 'expired';
  }

  const data =
    type === 'daily_digest'
      ? { dailyDigest: false }
      : type === 'weekly_summary'
        ? { weeklySummary: false }
        : type === 'marketing'
          ? { marketingEmails: false }
          : {
              dailyDigest: false,
              weeklySummary: false,
              marketingEmails: false,
            };

  await db.notificationPreferences.update({
    where: { id: preferences.id },
    data,
  });
  return 'success';
}

/**
 * Client opt-out state + link (get-or-create: the token must exist before
 * an email links to it). `optedOut` = the client refused the commercial /
 * follow-up emails — the caller must NOT send.
 */
export async function getClientUnsubscribe(
  email: string
): Promise<{ optedOut: boolean; unsubscribeUrl: string }> {
  const normalized = email.toLowerCase();
  const preference = await db.clientEmailPreference.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized },
    select: { marketingOptOut: true, unsubscribeToken: true },
  });
  return {
    optedOut: preference.marketingOptOut,
    unsubscribeUrl: buildClientUnsubscribeUrl(preference.unsubscribeToken),
  };
}

/** Consumer side of the client link. Idempotent. */
export async function applyClientUnsubscribe(
  token: string
): Promise<{ ok: boolean; preferenceId?: string }> {
  const preference = await db.clientEmailPreference.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true },
  });
  if (!preference) {
    return { ok: false };
  }
  await db.clientEmailPreference.update({
    where: { id: preference.id },
    data: { marketingOptOut: true },
  });
  return { ok: true, preferenceId: preference.id };
}
