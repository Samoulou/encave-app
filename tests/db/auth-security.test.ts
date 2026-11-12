/**
 * Security lot (pre-launch audit 2026-11-12) — the REAL better-auth
 * configuration (src/server/better-auth.ts, Prisma adapter, plugins, hooks)
 * driven through its HTTP handler against a REAL migrated database.
 *
 * Why a DB suite: every guarantee below lives in the interplay between our
 * config/hooks and better-auth internals (1.4 → 1.7 upgrade) — a unit test
 * with mocks would only restate the config. Covered:
 *  - B1  role can never be set from a request body (sign-up / update-user);
 *  - M3  pre-account hijack: an email-OTP sign-in to an UNVERIFIED account
 *        wipes the pre-existing password and sessions; a password reset
 *        revokes every session;
 *  - M1  a suspended user cannot obtain a session on any path;
 *  - G-1 (auth-hardening port to 1.7): a TOTP-enrolled user signing in by
 *        email OTP is challenged, gets no session, and the challenge minted
 *        by OUR hook is completable by the built-in /two-factor/verify-totp.
 *
 * Run with:
 *   INVARIANTS_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/encave_inv_sec \
 *     npx vitest run --no-file-parallelism tests/db/auth-security.test.ts
 * Skipped when the env var is absent.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createOTP } from '@better-auth/utils/otp';

const url = process.env.INVARIANTS_DATABASE_URL;
const BASE_URL = 'http://localhost:3000';

if (url) {
  process.env.DATABASE_URL = url;
}
process.env.BETTER_AUTH_URL = BASE_URL;
// Rate limiting is its own concern (and its budgets — 3 sign-ups/hour —
// would starve this suite): same switch the Playwright suite uses.
process.env.E2E_TEST = 'true';
delete process.env.VERCEL_ENV;

const { sentOtps } = vi.hoisted(() => ({
  sentOtps: [] as { email: string; otp: string; type: string }[],
}));

// Capture the codes better-auth hands to our mailer instead of sending.
vi.mock('@/server/services/email.service', () => ({
  sendOtpEmail: vi.fn(async (email: string, otp: string, type: string) => {
    sentOtps.push({ email, otp, type });
  }),
  sendEmailVerificationEmail: vi.fn(async () => {}),
  sendEmailChangedNoticeEmail: vi.fn(async () => {}),
}));

type BetterAuthModule = typeof import('@/server/better-auth');

/** Minimal cookie jar: applies Set-Cookie (incl. deletions) per client. */
class Client {
  private cookies = new Map<string, string>();
  private readonly auth: BetterAuthModule['auth'];

  constructor(authInstance: BetterAuthModule['auth']) {
    this.auth = authInstance;
  }

  has(nameSuffix: string): boolean {
    return Array.from(this.cookies.keys()).some((k) => k.endsWith(nameSuffix));
  }

  async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<{ status: number; json: Record<string, unknown> | null }> {
    const headers = new Headers({ origin: BASE_URL });
    if (this.cookies.size > 0) {
      headers.set(
        'cookie',
        Array.from(this.cookies.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ')
      );
    }
    if (body !== undefined) headers.set('content-type', 'application/json');

    const response = await this.auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    );

    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(';');
      const eq = (pair ?? '').indexOf('=');
      if (eq < 0) continue;
      const name = (pair ?? '').slice(0, eq).trim();
      const value = (pair ?? '').slice(eq + 1).trim();
      const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a));
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }

    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json };
  }

  post(path: string, body: unknown = {}) {
    return this.request('POST', path, body);
  }
}

describe.skipIf(!url)('auth security (real better-auth config + DB)', () => {
  let db: PrismaClient;
  let auth: BetterAuthModule['auth'];
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emails: string[] = [];
  const PASSWORD = 'Correct-horse-42';

  function freshEmail(label: string): string {
    const email = `sec-${label}-${stamp}@test.encave.ch`;
    emails.push(email);
    return email;
  }

  function lastOtp(email: string, type: string): string {
    const match = [...sentOtps]
      .reverse()
      .find((o) => o.email === email && o.type === type);
    if (!match) throw new Error(`no ${type} OTP captured for ${email}`);
    return match.otp;
  }

  async function signUp(client: Client, email: string, extra = {}) {
    return client.post('/sign-up/email', {
      name: 'Sec Test',
      email,
      password: PASSWORD,
      ...extra,
    });
  }

  async function userRow(email: string) {
    return db.user.findUniqueOrThrow({
      where: { email },
      include: { accounts: true, sessions: true },
    });
  }

  beforeAll(async () => {
    ({ auth } = await import('@/server/better-auth'));
    db = new PrismaClient({ datasourceUrl: url });
  });

  afterAll(async () => {
    if (!db) return;
    // Users cascade to sessions / accounts / two_factors.
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.verification.deleteMany({
      where: {
        OR: emails.map((email) => ({ identifier: { contains: email } })),
      },
    });
    await db.$disconnect();
  });

  describe('B1 — role is never client-settable', () => {
    it('sign-up with role=ADMIN creates a CLIENT', async () => {
      const email = freshEmail('role-signup');
      const res = await signUp(new Client(auth), email, { role: 'ADMIN' });

      expect(res.status).toBe(200);
      expect((await userRow(email)).role).toBe('CLIENT');
    });

    it('update-user with role=ADMIN is rejected and changes nothing', async () => {
      const email = freshEmail('role-update');
      const client = new Client(auth);
      await signUp(client, email);

      const res = await client.post('/update-user', { role: 'ADMIN' });

      expect(res.status).toBe(400);
      expect((await userRow(email)).role).toBe('CLIENT');
    });
  });

  describe('M3 — pre-account hijack', () => {
    it('an email-OTP sign-in to an UNVERIFIED account wipes the squatter password and sessions', async () => {
      const email = freshEmail('prehijack');

      // The squatter registers the victim's address with their own password
      // and holds a live session.
      const squatter = new Client(auth);
      expect((await signUp(squatter, email)).status).toBe(200);
      const before = await userRow(email);
      expect(before.emailVerified).toBe(false);
      expect(before.accounts.map((a) => a.providerId)).toEqual(['credential']);
      expect(before.sessions).toHaveLength(1);
      const squatterSessionToken = before.sessions[0]?.token;

      // The real owner proves the mailbox with an email OTP.
      const owner = new Client(auth);
      await owner.post('/email-otp/send-verification-otp', {
        email,
        type: 'sign-in',
      });
      const res = await owner.post('/sign-in/email-otp', {
        email,
        otp: lastOtp(email, 'sign-in'),
      });
      expect(res.status).toBe(200);

      const after = await userRow(email);
      expect(after.emailVerified).toBe(true);
      // The password the squatter knows is gone…
      expect(after.accounts).toHaveLength(0);
      // …and so is their session: only the owner's new one remains.
      expect(after.sessions).toHaveLength(1);
      expect(after.sessions[0]?.token).not.toBe(squatterSessionToken);

      const relogin = await new Client(auth).post('/sign-in/email', {
        email,
        password: PASSWORD,
      });
      expect(relogin.status).toBe(401);
    });

    it('a password reset revokes every existing session', async () => {
      const email = freshEmail('reset');
      const oldDevice = new Client(auth);
      await signUp(oldDevice, email);
      expect((await userRow(email)).sessions).toHaveLength(1);

      const resetter = new Client(auth);
      await resetter.post('/email-otp/send-verification-otp', {
        email,
        type: 'forget-password',
      });
      const NEW_PASSWORD = 'Another-pass-77';
      const res = await resetter.post('/email-otp/reset-password', {
        email,
        otp: lastOtp(email, 'forget-password'),
        password: NEW_PASSWORD,
      });
      expect(res.status).toBe(200);

      expect((await userRow(email)).sessions).toHaveLength(0);

      const oldPassword = await new Client(auth).post('/sign-in/email', {
        email,
        password: PASSWORD,
      });
      expect(oldPassword.status).toBe(401);
      const newPassword = await new Client(auth).post('/sign-in/email', {
        email,
        password: NEW_PASSWORD,
      });
      expect(newPassword.status).toBe(200);
    });

    it('keeps the 1.7 OAuth gate: no implicit link to an unverified local email', () => {
      // handleOAuthUserInfo refuses the link unless the option is false.
      expect(
        auth.options.account?.accountLinking?.requireLocalEmailVerified
      ).not.toBe(false);
      expect(auth.options.account?.accountLinking?.allowDifferentEmails).toBe(
        false
      );
    });
  });

  describe('M1 — a suspended user cannot obtain a session', () => {
    it('password sign-in is refused with ACCOUNT_SUSPENDED and creates no session', async () => {
      const email = freshEmail('suspended-pw');
      await signUp(new Client(auth), email);
      await db.session.deleteMany({ where: { user: { email } } });
      await db.user.update({
        where: { email },
        data: { suspendedAt: new Date() },
      });

      const client = new Client(auth);
      const res = await client.post('/sign-in/email', {
        email,
        password: PASSWORD,
      });

      expect(res.status).toBe(403);
      expect(res.json?.code).toBe('ACCOUNT_SUSPENDED');
      expect(client.has('session_token')).toBe(false);
      expect((await userRow(email)).sessions).toHaveLength(0);
    });

    it('email-OTP sign-in is refused too', async () => {
      const email = freshEmail('suspended-otp');
      await signUp(new Client(auth), email);
      await db.session.deleteMany({ where: { user: { email } } });
      await db.user.update({
        where: { email },
        data: { suspendedAt: new Date(), emailVerified: true },
      });

      const client = new Client(auth);
      await client.post('/email-otp/send-verification-otp', {
        email,
        type: 'sign-in',
      });
      const res = await client.post('/sign-in/email-otp', {
        email,
        otp: lastOtp(email, 'sign-in'),
      });

      expect(res.status).toBe(403);
      expect(res.json?.code).toBe('ACCOUNT_SUSPENDED');
      expect((await userRow(email)).sessions).toHaveLength(0);
    });

    it('reinstating the user restores sign-in', async () => {
      const email = freshEmail('reinstated');
      await signUp(new Client(auth), email);
      await db.user.update({
        where: { email },
        data: { suspendedAt: new Date() },
      });
      const refused = await new Client(auth).post('/sign-in/email', {
        email,
        password: PASSWORD,
      });
      expect(refused.status).toBe(403);

      await db.user.update({ where: { email }, data: { suspendedAt: null } });
      const allowed = await new Client(auth).post('/sign-in/email', {
        email,
        password: PASSWORD,
      });
      expect(allowed.status).toBe(200);
    });
  });

  describe('G-1 — TOTP is challenged on the email-OTP path (1.7 port)', () => {
    it('enrols TOTP, then an OTP sign-in gets a challenge our hook minted and verify-totp completes it', async () => {
      const email = freshEmail('totp');
      const enrolment = new Client(auth);
      await signUp(enrolment, email);
      await db.user.update({ where: { email }, data: { emailVerified: true } });

      // --- enrolment (same calls as TotpSetupSection)
      const enabled = await enrolment.post('/two-factor/enable', {
        password: PASSWORD,
      });
      expect(enabled.status).toBe(200);
      expect(enabled.json?.method).toBe('totp');
      const totpUri = new URL(String(enabled.json?.totpURI));
      const base32Secret = totpUri.searchParams.get('secret') ?? '';
      const { base32 } = await import('@better-auth/utils/base32');
      const secret = new TextDecoder().decode(base32.decode(base32Secret));
      const totp = () => createOTP(secret, { digits: 6, period: 30 }).totp();

      const confirmed = await enrolment.post('/two-factor/verify-totp', {
        code: await totp(),
      });
      expect(confirmed.status).toBe(200);
      const enrolled = await userRow(email);
      expect(enrolled.twoFactorEnabled).toBe(true);
      const twoFactorRow = await db.twoFactor.findUniqueOrThrow({
        where: { userId: enrolled.id },
      });
      expect(twoFactorRow.verified).toBe(true);

      await db.session.deleteMany({ where: { userId: enrolled.id } });

      // --- email-OTP sign-in: the built-in plugin does NOT cover this path
      const client = new Client(auth);
      await client.post('/email-otp/send-verification-otp', {
        email,
        type: 'sign-in',
      });
      const challenged = await client.post('/sign-in/email-otp', {
        email,
        otp: lastOtp(email, 'sign-in'),
      });

      expect(challenged.status).toBe(200);
      expect(challenged.json?.twoFactorRedirect).toBe(true);
      expect(challenged.json?.token).toBeUndefined();
      // No session: neither a cookie nor a row survives the challenge.
      expect(client.has('session_token')).toBe(false);
      expect(client.has('two_factor')).toBe(true);
      expect(await db.session.count({ where: { userId: enrolled.id } })).toBe(
        0
      );

      // A wrong code is refused and does not open a session…
      const wrong = await client.post('/two-factor/verify-totp', {
        code: '000000',
      });
      expect(wrong.status).toBe(401);
      expect(await db.session.count({ where: { userId: enrolled.id } })).toBe(
        0
      );

      // …the right one completes the challenge OUR hook created.
      const verified = await client.post('/two-factor/verify-totp', {
        code: await totp(),
      });
      expect(verified.status).toBe(200);
      expect(typeof verified.json?.token).toBe('string');
      expect(client.has('session_token')).toBe(true);
      expect(await db.session.count({ where: { userId: enrolled.id } })).toBe(
        1
      );
    });

    it('the built-in password path still challenges an enrolled user', async () => {
      const email = emails.find((e) => e.startsWith('sec-totp-'));
      if (!email) throw new Error('enrolled fixture missing');

      const client = new Client(auth);
      const res = await client.post('/sign-in/email', {
        email,
        password: PASSWORD,
      });

      expect(res.status).toBe(200);
      expect(res.json?.twoFactorRedirect).toBe(true);
      expect(client.has('session_token')).toBe(false);
    });
  });
});
