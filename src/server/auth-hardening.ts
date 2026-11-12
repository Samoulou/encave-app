import { createAuthMiddleware } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { generateRandomString } from 'better-auth/crypto';
import type { BetterAuthPlugin } from 'better-auth';
import { db } from '@/server/db';
import { sendEmailChangedNoticeEmail } from '@/server/services/email.service';
import { logError, logInfo } from '@/lib/logger';
import type { Locale } from '@prisma/client';

/**
 * P-16 / WS-G — closes the three P-14 security gaps documented in
 * docs/plans/P-14-auth-v3.md §6bis.
 *
 * G-1: the built-in twoFactor plugin only challenges `/sign-in/email` — a
 *      TOTP-enrolled admin signing in via email OTP or Google entered
 *      /admin unchallenged. This plugin mirrors the built-in after-hook on
 *      those paths (session revoked, signed `two_factor` cookie, then
 *      `twoFactorRedirect` for JSON flows / a redirect to /login/2fa for
 *      the OAuth callback). Deliberately stricter than the built-in: no
 *      trust-device shortcut on these paths.
 *
 * G-2: better-auth's changeEmail asks the CURRENT address for confirmation
 *      only when it is verified; the instant-change path was silent for
 *      the previous owner. The after-hook posts a security notice to the
 *      old address whenever that path applies.
 *
 * G-3 (session cap) is enforced at the admin boundary — see
 * `isCurrentAdminSessionExpired` in src/server/auth.ts and the admin
 * layout.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-role session length (P-14 / L-153). Applied at login via the session
 * create hook and re-checked at the admin boundary (G-3).
 */
export function sessionWindowMsForRole(role: string | undefined): number {
  switch (role) {
    case 'WINEMAKER':
      return 90 * DAY_MS;
    case 'ADMIN':
      return 7 * DAY_MS;
    default:
      return 30 * DAY_MS; // CLIENT
  }
}

/**
 * G-3 predicate (pure): a session whose creation is older than its role
 * window is expired regardless of the sliding `updateAge` refresh, which
 * resets `expiresAt` to the GLOBAL 90d window (better-auth session.mjs).
 */
export function isSessionPastRoleWindow(
  createdAt: Date | string,
  role: string | undefined,
  now: number = Date.now()
): boolean {
  return now - new Date(createdAt).getTime() > sessionWindowMsForRole(role);
}

/**
 * Central suspension gate, used by the session `create.before` database
 * hook (src/server/better-auth.ts): a suspended user — or a user row that
 * no longer exists — must never be handed a session, whatever the sign-in
 * path. Pure so it is unit-testable without better-auth.
 */
export function isSessionCreationBlocked(
  user: { suspendedAt: Date | null } | null | undefined
): boolean {
  if (!user) return true;
  return user.suspendedAt !== null;
}

// Mirrors better-auth's two-factor plugin constants and challenge records
// (pinned ^1.7.x — dist/plugins/two-factor/{constant,index,
// verify-two-factor}.mjs). Not exported by the package. RE-CHECK ON EVERY
// better-auth BUMP: verify-totp consumes BOTH verification rows below.
const TWO_FACTOR_COOKIE_NAME = 'two_factor';
const TWO_FACTOR_COOKIE_MAX_AGE_S = 600;

/** Identifier of the per-challenge attempt counter verify-totp consumes. */
export function twoFactorAttemptsIdentifier(challengeIdentifier: string) {
  return `2fa-attempts-${challengeIdentifier}`;
}

/** Paths G-1 covers on top of the built-in `/sign-in/email` matcher. */
export function isSecondFactorGapPath(path: string): boolean {
  return path === '/sign-in/email-otp' || path.startsWith('/callback/');
}

export function authHardening(): BetterAuthPlugin {
  return {
    id: 'auth-hardening',
    hooks: {
      after: [
        {
          // G-1 — TOTP challenge on the paths the built-in plugin misses.
          matcher: (context) =>
            context.path ? isSecondFactorGapPath(context.path) : false,
          handler: createAuthMiddleware(async (ctx) => {
            const data = ctx.context.newSession;
            if (!data) return;
            const enrolled = (
              data.user as { twoFactorEnabled?: boolean | null }
            ).twoFactorEnabled;
            if (!enrolled) return;

            // Same sequence as the built-in hook (two-factor/index.mjs,
            // 1.7): the fresh session must not survive an unchallenged
            // second factor, and downstream hooks must not observe it.
            deleteSessionCookie(ctx, true);
            await ctx.context.internalAdapter.deleteSession(data.session.token);
            ctx.context.setNewSession(null);
            const twoFactorCookie = ctx.context.createAuthCookie(
              TWO_FACTOR_COOKIE_NAME,
              { maxAge: TWO_FACTOR_COOKIE_MAX_AGE_S }
            );
            const identifier = `2fa-${generateRandomString(20)}`;
            const expiresAt = new Date(
              Date.now() + TWO_FACTOR_COOKIE_MAX_AGE_S * 1000
            );
            await ctx.context.internalAdapter.createVerificationValue({
              value: data.user.id,
              identifier,
              expiresAt,
            });
            // 1.7: verify-totp `beginAttempt` consumes this counter and
            // answers INVALID_TWO_FACTOR_COOKIE when it is missing — without
            // it the challenge minted here could never be completed.
            await ctx.context.internalAdapter.createVerificationValue({
              value: '0',
              identifier: twoFactorAttemptsIdentifier(identifier),
              expiresAt,
            });
            await ctx.setSignedCookie(
              twoFactorCookie.name,
              identifier,
              ctx.context.secret,
              twoFactorCookie.attributes
            );
            logInfo('second factor challenged on gap path (G-1)', {
              action: 'authHardening.secondFactor',
              path: ctx.path,
              userId: data.user.id,
            });

            if (ctx.path.startsWith('/callback/')) {
              // OAuth is a browser redirect flow — send the user to the
              // verify page (locale middleware adds the prefix). The
              // two_factor cookie set above carries the pending identity.
              const origin = new URL(ctx.context.baseURL).origin;
              throw ctx.redirect(`${origin}/login/2fa`);
            }
            // JSON flow: OtpLoginForm already routes on this flag (P-14).
            // `twoFactorMethods` mirrors the built-in response shape (1.7).
            return ctx.json({
              twoFactorRedirect: true,
              twoFactorMethods: ['totp'],
            });
          }),
        },
        {
          // G-2 — notify the OLD address on an instant email change.
          matcher: (context) => context.path === '/change-email',
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned as
              | { status?: boolean }
              | undefined;
            if (returned && returned.status === false) return;
            const sessionUser = ctx.context.session?.user as
              | {
                  id: string;
                  email: string;
                  emailVerified?: boolean | null;
                  preferredLocale?: Locale | null;
                }
              | undefined;
            const newEmail = (ctx.body as { newEmail?: string } | undefined)
              ?.newEmail;
            if (!sessionUser || !newEmail) return;
            // Verified current address → better-auth already routed a
            // confirmation link to it; the silent path is unverified only.
            if (sessionUser.emailVerified) return;
            // Confirm the change actually landed before notifying.
            const fresh = await db.user.findUnique({
              where: { id: sessionUser.id },
              select: { email: true },
            });
            if (fresh?.email !== newEmail.toLowerCase()) return;
            try {
              await sendEmailChangedNoticeEmail(
                sessionUser.email,
                newEmail,
                sessionUser.preferredLocale ?? 'FR'
              );
            } catch (error) {
              // Notice best-effort: never fail the auth response over email.
              logError('email-changed notice failed (G-2)', error, {
                action: 'authHardening.emailChangedNotice',
                userId: sessionUser.id,
              });
            }
          }),
        },
      ],
    },
  };
}
