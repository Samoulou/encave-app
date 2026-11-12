/**
 * Client reminder + follow-up crons against a REAL migrated database
 * (pre-launch audit, lot « emails + ops »).
 *
 * Under test:
 * - reminders: the 2h reminder fires on the hourly cadence for ANY session
 *   hour (it used to be reachable only for ~19:30–20:30 sessions), exactly
 *   once per booking; the J-1 reminder still goes at 18h Europe/Zurich and
 *   a later run the same evening catches up what the 18h run left behind —
 *   without "reminding" a booking made after 18h;
 * - the claim-before-send marker: a failed send releases it (retry on the
 *   next run), two overlapping runs never both send;
 * - follow-ups: tokenised client opt-out link, opted-out clients skipped.
 *
 * Handlers are called bare (`GET()`), they decide from the CLOCK — same
 * doctrine as tests/db/cron-routes.test.ts.
 *
 * Run with:
 *   INVARIANTS_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/encave_inv_mail \
 *   DIRECT_URL=$INVARIANTS_DATABASE_URL npx vitest run tests/db/reminder-crons.test.ts
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import { PrismaClient, BookingStatus } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

const CRON_SECRET = 'dbtest-cron-secret-0123456789abcdef';
process.env.CRON_SECRET = CRON_SECRET;
process.env.BETTER_AUTH_URL = 'https://test.encave.ch';
// No DSN → withCronMonitor is a plain passthrough.
delete process.env.NEXT_PUBLIC_SENTRY_DSN;

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ authorization: `Bearer ${CRON_SECRET}` }),
}));

vi.mock('@/server/services/email.service', () => ({
  sendBookingReminderEmail: vi.fn(async () => true),
  sendClientReminder2hEmail: vi.fn(async () => true),
  sendPostExperienceFollowUpEmail: vi.fn(async () => true),
}));

describe.skipIf(!url)('reminder + follow-up crons (emails lot)', () => {
  let db: PrismaClient;
  const RUN_TAG = `remcron${Date.now()}`;
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};

  const email = (name: string) => `${RUN_TAG}-${name}@test.encave.ch`;

  function makeBooking(input: {
    date: string;
    timeSlot: string;
    email: string;
    status?: BookingStatus;
    createdAt?: Date;
    reminder24hSentAt?: Date | null;
  }) {
    if (!ids.experienceId || !ids.wineryId) throw new Error('fixture missing');
    return db.booking.create({
      data: {
        reference: `ENC-RM${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        visitorEmail: input.email,
        visitorName: 'Client Rappel',
        visitorPhone: '+41790000003',
        experienceId: ids.experienceId,
        wineryId: ids.wineryId,
        date: new Date(`${input.date}T00:00:00.000Z`),
        timeSlot: input.timeSlot,
        guestCount: 2,
        totalPrice: 5000,
        platformFee: 600,
        wineryPayout: 4400,
        locale: 'DE',
        status: input.status ?? BookingStatus.CONFIRMED,
        reminder24hSentAt: input.reminder24hSentAt ?? null,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
      select: { id: true },
    });
  }

  const markers = (id: string) =>
    db.booking.findUniqueOrThrow({
      where: { id },
      select: {
        reminder24hSentAt: true,
        reminder2hSentAt: true,
        followUpSentAt: true,
      },
    });

  async function runReminders(at: string) {
    const { GET } = await import('@/app/api/cron/reminders/route');
    vi.setSystemTime(new Date(at));
    const res = await GET();
    expect(res.status).toBe(200);
    return (await res.json()) as {
      results: {
        reminder24h: { sent: number; failed: number; skipped: number };
        reminder2h: { sent: number; failed: number; skipped: number };
      };
    };
  }

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    const user = await db.user.create({
      data: { email: email('owner'), role: 'WINEMAKER' },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Reminder Crons Winery ${RUN_TAG}`,
        slug: `reminder-crons-${RUN_TAG}`,
        description: 'Reminder crons test fixture',
        address: 'Route du Test 11',
        commune: 'Sion',
        phone: '+41270000011',
        email: email('cave'),
        userId: user.id,
        status: 'VERIFIED',
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Reminder Crons Experience',
        slug: `reminder-crons-${RUN_TAG}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 90,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 8,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'DRAFT',
      },
    });
    ids.experienceId = experience.id;
  });

  beforeEach(async () => {
    const emailService = await import('@/server/services/email.service');
    vi.mocked(emailService.sendBookingReminderEmail).mockReset();
    vi.mocked(emailService.sendBookingReminderEmail).mockResolvedValue(true);
    vi.mocked(emailService.sendClientReminder2hEmail).mockReset();
    vi.mocked(emailService.sendClientReminder2hEmail).mockResolvedValue(true);
    vi.mocked(emailService.sendPostExperienceFollowUpEmail).mockReset();
    vi.mocked(emailService.sendPostExperienceFollowUpEmail).mockResolvedValue(
      true
    );
    // Each test owns its bookings: a leftover would be picked by the next
    // test's run (the crons sweep the whole table).
    if (ids.wineryId) {
      await db.booking.deleteMany({ where: { wineryId: ids.wineryId } });
    }
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    if (ids.wineryId) {
      await db.emailLog
        .deleteMany({ where: { recipientId: { contains: RUN_TAG } } })
        .catch(() => {});
      await db.booking
        .deleteMany({ where: { wineryId: ids.wineryId } })
        .catch(() => {});
    }
    await db.clientEmailPreference
      .deleteMany({ where: { email: { contains: RUN_TAG } } })
      .catch(() => {});
    if (ids.userId) {
      await db.user.delete({ where: { id: ids.userId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  describe('2h reminder — hourly cadence', () => {
    it('a MORNING session gets it, exactly once, in the guest locale', async () => {
      const emailService = await import('@/server/services/email.service');
      const send = vi.mocked(emailService.sendClientReminder2hEmail);
      // 10:00 Zurich on 2026-11-20 (CET) = 09:00 UTC. J-1 already sent.
      const booking = await makeBooking({
        date: '2026-11-20',
        timeSlot: '10:00',
        email: email('morning'),
        reminder24hSentAt: new Date('2026-11-19T17:00:00.000Z'),
      });

      // 05:00 UTC = 4h before → too early.
      let body = await runReminders('2026-11-20T05:00:00.000Z');
      expect(body.results.reminder2h.sent).toBe(0);
      expect(send).not.toHaveBeenCalled();
      expect((await markers(booking.id)).reminder2hSentAt).toBeNull();

      // 07:00 UTC = 2h before → sends.
      body = await runReminders('2026-11-20T07:00:00.000Z');
      expect(body.results.reminder2h.sent).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0]).toBe(email('morning'));
      expect(send.mock.calls[0]?.[2]).toBe('DE');
      // The email prints the real start instant (10:00 Zurich = 09:00 UTC).
      expect(send.mock.calls[0]?.[1].date.toISOString()).toBe(
        '2026-11-20T09:00:00.000Z'
      );
      expect((await markers(booking.id)).reminder2hSentAt).not.toBeNull();

      // 08:00 UTC = 1h before: still inside the catch-up half of the
      // window, but the marker is set → no second email.
      body = await runReminders('2026-11-20T08:00:00.000Z');
      expect(body.results.reminder2h.sent).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('a failed send releases the claim: the next hourly run retries', async () => {
      const emailService = await import('@/server/services/email.service');
      const send = vi.mocked(emailService.sendClientReminder2hEmail);
      const booking = await makeBooking({
        date: '2026-11-20',
        timeSlot: '15:00', // 14:00 UTC
        email: email('retry'),
        reminder24hSentAt: new Date('2026-11-19T17:00:00.000Z'),
      });

      send.mockResolvedValueOnce(false);
      // 12:00 UTC = 2h before → fails.
      let body = await runReminders('2026-11-20T12:00:00.000Z');
      expect(body.results.reminder2h).toMatchObject({ sent: 0, failed: 1 });
      expect((await markers(booking.id)).reminder2hSentAt).toBeNull();

      // 12:59 UTC = 1h01 before → still in (1h, 2h30]: catch-up succeeds.
      body = await runReminders('2026-11-20T12:59:00.000Z');
      expect(body.results.reminder2h.sent).toBe(1);
      expect(send).toHaveBeenCalledTimes(2);
      expect((await markers(booking.id)).reminder2hSentAt).not.toBeNull();
    });

    it('two overlapping runs send ONE email (claim before send)', async () => {
      const emailService = await import('@/server/services/email.service');
      const send = vi.mocked(emailService.sendClientReminder2hEmail);
      await makeBooking({
        date: '2026-11-20',
        timeSlot: '15:00',
        email: email('overlap'),
        reminder24hSentAt: new Date('2026-11-19T17:00:00.000Z'),
      });
      const { GET } = await import('@/app/api/cron/reminders/route');
      vi.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));

      const [a, b] = await Promise.all([GET(), GET()]);
      const sent =
        (await a.json()).results.reminder2h.sent +
        (await b.json()).results.reminder2h.sent;

      expect(sent).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('skips a booking that never got its J-1 reminder (same-day booking)', async () => {
      const emailService = await import('@/server/services/email.service');
      await makeBooking({
        date: '2026-11-20',
        timeSlot: '15:00',
        email: email('sameday'),
      });

      const body = await runReminders('2026-11-20T12:00:00.000Z');

      expect(body.results.reminder2h.sent).toBe(0);
      expect(
        vi.mocked(emailService.sendClientReminder2hEmail)
      ).not.toHaveBeenCalled();
    });
  });

  describe('J-1 reminder — 18h Zurich + evening catch-up', () => {
    it('18h run sends; a later run does not send again', async () => {
      const emailService = await import('@/server/services/email.service');
      const send = vi.mocked(emailService.sendBookingReminderEmail);
      const booking = await makeBooking({
        date: '2026-11-20',
        timeSlot: '10:00',
        email: email('j1'),
        createdAt: new Date('2026-11-10T09:00:00.000Z'),
      });

      // 17:00 UTC = 18h CET on the 19th.
      let body = await runReminders('2026-11-19T17:00:00.000Z');
      expect(body.results.reminder24h.sent).toBe(1);
      expect((await markers(booking.id)).reminder24hSentAt).not.toBeNull();

      // 18:00 UTC = 19h CET: catch-up run, nothing left.
      body = await runReminders('2026-11-19T18:00:00.000Z');
      expect(body.results.reminder24h.sent).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('a booking the 18h run failed on is caught up at 19h', async () => {
      const emailService = await import('@/server/services/email.service');
      const send = vi.mocked(emailService.sendBookingReminderEmail);
      const booking = await makeBooking({
        date: '2026-11-20',
        timeSlot: '10:00',
        email: email('j1-catchup'),
        createdAt: new Date('2026-11-10T09:00:00.000Z'),
      });

      send.mockResolvedValueOnce(false);
      let body = await runReminders('2026-11-19T17:00:00.000Z');
      expect(body.results.reminder24h).toMatchObject({ sent: 0, failed: 1 });
      expect((await markers(booking.id)).reminder24hSentAt).toBeNull();

      body = await runReminders('2026-11-19T18:00:00.000Z');
      expect(body.results.reminder24h.sent).toBe(1);
      expect((await markers(booking.id)).reminder24hSentAt).not.toBeNull();
    });

    it('the catch-up never "reminds" a booking made after 18h', async () => {
      const emailService = await import('@/server/services/email.service');
      const booking = await makeBooking({
        date: '2026-11-20',
        timeSlot: '10:00',
        email: email('late-booker'),
        // Booked at 18:30 Zurich (17:30 UTC) for tomorrow morning.
        createdAt: new Date('2026-11-19T17:30:00.000Z'),
      });

      const body = await runReminders('2026-11-19T18:00:00.000Z');

      expect(body.results.reminder24h.sent).toBe(0);
      expect(
        vi.mocked(emailService.sendBookingReminderEmail)
      ).not.toHaveBeenCalled();
      expect((await markers(booking.id)).reminder24hSentAt).toBeNull();
    });

    it('stays inert before 18h Zurich', async () => {
      const emailService = await import('@/server/services/email.service');
      await makeBooking({
        date: '2026-11-20',
        timeSlot: '10:00',
        email: email('j1-early'),
        createdAt: new Date('2026-11-10T09:00:00.000Z'),
      });

      // 16:00 UTC = 17h CET.
      const body = await runReminders('2026-11-19T16:00:00.000Z');

      expect(body.results.reminder24h.sent).toBe(0);
      expect(
        vi.mocked(emailService.sendBookingReminderEmail)
      ).not.toHaveBeenCalled();
    });
  });

  describe('follow-ups — tokenised opt-out', () => {
    async function runFollowUps(at: string) {
      const { GET } = await import('@/app/api/cron/follow-ups/route');
      vi.setSystemTime(new Date(at));
      const res = await GET();
      expect(res.status).toBe(200);
      return (await res.json()) as {
        results: { sent: number; failed: number; skippedOptedOut: number };
      };
    }

    it('sends with the client tokenised unsubscribe URL, once', async () => {
      const emailService = await import('@/server/services/email.service');
      const send = vi.mocked(emailService.sendPostExperienceFollowUpEmail);
      const booking = await makeBooking({
        date: '2026-11-19',
        timeSlot: '10:00',
        email: email('followup'),
        status: BookingStatus.COMPLETED,
      });

      // 08:00 UTC the day after: the session ended 21:30h ago → too recent.
      let body = await runFollowUps('2026-11-20T08:00:00.000Z');
      expect(body.results.sent).toBe(0);

      // Next daily run: sends.
      body = await runFollowUps('2026-11-21T08:00:00.000Z');
      expect(body.results.sent).toBe(1);
      const preference = await db.clientEmailPreference.findUniqueOrThrow({
        where: { email: email('followup') },
      });
      expect(send.mock.calls[0]?.[1].unsubscribeUrl).toBe(
        `https://test.encave.ch/api/unsubscribe/client/${preference.unsubscribeToken}`
      );
      expect((await markers(booking.id)).followUpSentAt).not.toBeNull();

      // And never twice.
      body = await runFollowUps('2026-11-22T08:00:00.000Z');
      expect(body.results.sent).toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('an opted-out client receives nothing', async () => {
      const emailService = await import('@/server/services/email.service');
      await db.clientEmailPreference.create({
        data: { email: email('optout'), marketingOptOut: true },
      });
      const booking = await makeBooking({
        date: '2026-11-19',
        timeSlot: '10:00',
        // Mixed case on purpose: preferences are keyed by lower-cased email.
        email: email('OptOut'),
        status: BookingStatus.COMPLETED,
      });

      const body = await runFollowUps('2026-11-21T08:00:00.000Z');

      expect(body.results).toMatchObject({ sent: 0, skippedOptedOut: 1 });
      expect(
        vi.mocked(emailService.sendPostExperienceFollowUpEmail)
      ).not.toHaveBeenCalled();
      // Marked handled: not re-evaluated on the following runs.
      expect((await markers(booking.id)).followUpSentAt).not.toBeNull();
    });

    it('a failed send releases the claim for the next daily run', async () => {
      const emailService = await import('@/server/services/email.service');
      const send = vi.mocked(emailService.sendPostExperienceFollowUpEmail);
      const booking = await makeBooking({
        date: '2026-11-19',
        timeSlot: '10:00',
        email: email('followup-retry'),
        status: BookingStatus.COMPLETED,
      });

      send.mockResolvedValueOnce(false);
      let body = await runFollowUps('2026-11-21T08:00:00.000Z');
      expect(body.results).toMatchObject({ sent: 0, failed: 1 });
      expect((await markers(booking.id)).followUpSentAt).toBeNull();

      body = await runFollowUps('2026-11-22T08:00:00.000Z');
      expect(body.results.sent).toBe(1);
    });
  });
});
