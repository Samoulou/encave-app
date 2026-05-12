import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findFirst: vi.fn(),
    },
  },
}));

// Disable next/cache wrappers — execute the inner function directly.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
}));

// React.cache wraps with memoization; passthrough for tests.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

import { db } from '@/server/db';
import { getEventDetail } from '@/server/queries/event-detail.queries';
import { BookingStatus, ExperienceStatus } from '@prisma/client';

const baseExperience = {
  id: 'exp-1',
  title: 'Dégustation verticale',
  slug: 'tasting',
  type: 'TASTING' as const,
  status: ExperienceStatus.PUBLISHED,
  duration: 90,
  maxCapacity: 10,
  wineryId: 'winery-1',
  winery: { id: 'winery-1', slug: 'domaine-x', name: 'Domaine X', userId: 'u1' },
};

function makeBooking(overrides: {
  id: string;
  status: BookingStatus;
  date: string; // YYYY-MM-DD UTC midnight
  timeSlot: string;
  guestCount?: number;
  checkedInAt?: Date | null;
}) {
  return {
    id: overrides.id,
    reference: `ENC-${overrides.id.toUpperCase()}`,
    visitorName: 'Alice',
    visitorEmail: 'a@test.ch',
    visitorPhone: '+41',
    guestCount: overrides.guestCount ?? 2,
    status: overrides.status,
    checkedInAt: overrides.checkedInAt ?? null,
    createdAt: new Date('2026-04-01T10:00:00Z'),
    date: new Date(`${overrides.date}T00:00:00Z`),
    timeSlot: overrides.timeSlot,
  };
}

describe('getEventDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Anchor "now" so today/upcoming/past classification is deterministic.
    // Today = 2026-05-12 (Europe/Zurich CEST, +02:00).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T12:00:00Z'));
  });

  it('returns null when experience is not found / not owned', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue(null);

    const result = await getEventDetail('tasting', 'u1');

    expect(result).toBeNull();
  });

  it('groups bookings by (date, timeSlot) into one session', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      ...baseExperience,
      bookings: [
        makeBooking({
          id: 'b1',
          status: BookingStatus.CONFIRMED,
          date: '2026-06-12',
          timeSlot: '14:00',
        }),
        makeBooking({
          id: 'b2',
          status: BookingStatus.CONFIRMED,
          date: '2026-06-12',
          timeSlot: '14:00',
        }),
        makeBooking({
          id: 'b3',
          status: BookingStatus.CONFIRMED,
          date: '2026-06-12',
          timeSlot: '16:00',
        }),
      ],
    } as never);

    const result = await getEventDetail('tasting', 'u1');

    expect(result).not.toBeNull();
    expect(result!.sessions).toHaveLength(2);
    const s1 = result!.sessions.find((s) => s.timeSlot === '14:00')!;
    expect(s1.bookings).toHaveLength(2);
    expect(s1.bookings.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
  });

  it('capacity counts CONFIRMED + COMPLETED + NO_SHOW; ignores CANCELLED_*', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      ...baseExperience,
      bookings: [
        makeBooking({
          id: 'a',
          status: BookingStatus.CONFIRMED,
          date: '2026-06-12',
          timeSlot: '14:00',
          guestCount: 2,
        }),
        makeBooking({
          id: 'b',
          status: BookingStatus.COMPLETED,
          date: '2026-06-12',
          timeSlot: '14:00',
          guestCount: 1,
        }),
        makeBooking({
          id: 'c',
          status: BookingStatus.NO_SHOW,
          date: '2026-06-12',
          timeSlot: '14:00',
          guestCount: 3,
        }),
        makeBooking({
          id: 'd',
          status: BookingStatus.CANCELLED_BY_CLIENT,
          date: '2026-06-12',
          timeSlot: '14:00',
          guestCount: 5,
        }),
        makeBooking({
          id: 'e',
          status: BookingStatus.CANCELLED_BY_WINERY,
          date: '2026-06-12',
          timeSlot: '14:00',
          guestCount: 4,
        }),
      ],
    } as never);

    const result = await getEventDetail('tasting', 'u1');

    expect(result).not.toBeNull();
    expect(result!.sessions).toHaveLength(1);
    expect(result!.sessions[0]!.confirmedSeats).toBe(6); // 2 + 1 + 3
  });

  it('classifies sessions into today / upcoming / past correctly', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      ...baseExperience,
      bookings: [
        // Today (Europe/Zurich), starts at 14:00 → 12:00 UTC (CEST)
        makeBooking({
          id: 'today',
          status: BookingStatus.CONFIRMED,
          date: '2026-05-12',
          timeSlot: '17:00',
        }),
        // Upcoming
        makeBooking({
          id: 'upcoming',
          status: BookingStatus.CONFIRMED,
          date: '2026-06-12',
          timeSlot: '14:00',
        }),
        // Past
        makeBooking({
          id: 'past',
          status: BookingStatus.COMPLETED,
          date: '2026-04-01',
          timeSlot: '14:00',
        }),
      ],
    } as never);

    const result = await getEventDetail('tasting', 'u1');

    expect(result).not.toBeNull();
    const groups = result!.sessions.map((s) => s.group);
    // Order should be today → upcoming → past
    expect(groups).toEqual(['today', 'upcoming', 'past']);
  });

  it('routes sessions where every booking is CANCELLED_* into "cancelled" bucket', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      ...baseExperience,
      bookings: [
        makeBooking({
          id: 'x',
          status: BookingStatus.CANCELLED_BY_CLIENT,
          date: '2026-06-12',
          timeSlot: '14:00',
        }),
        makeBooking({
          id: 'y',
          status: BookingStatus.CANCELLED_BY_WINERY,
          date: '2026-06-12',
          timeSlot: '14:00',
        }),
      ],
    } as never);

    const result = await getEventDetail('tasting', 'u1');

    expect(result).not.toBeNull();
    expect(result!.sessions).toHaveLength(1);
    expect(result!.sessions[0]!.group).toBe('cancelled');
    expect(result!.sessions[0]!.confirmedSeats).toBe(0);
  });

  it('totals only include today + upcoming sessions (not past, not cancelled)', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      ...baseExperience,
      bookings: [
        makeBooking({
          id: 'up',
          status: BookingStatus.CONFIRMED,
          date: '2026-06-12',
          timeSlot: '14:00',
          guestCount: 3,
        }),
        makeBooking({
          id: 'past',
          status: BookingStatus.COMPLETED,
          date: '2026-04-01',
          timeSlot: '14:00',
          guestCount: 5,
        }),
      ],
    } as never);

    const result = await getEventDetail('tasting', 'u1');

    expect(result).not.toBeNull();
    expect(result!.totalConfirmedSeats).toBe(3);
    expect(result!.activeSessionsCount).toBe(1);
    expect(result!.totalActiveCapacity).toBe(10);
  });

  it('PENDING_PAYMENT bookings are excluded by the query filter', async () => {
    // The query filters by `status: { in: SESSION_DISPLAY_STATUSES }` which
    // excludes PENDING_PAYMENT. Verify the where-clause carries that filter.
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      ...baseExperience,
      bookings: [],
    } as never);

    await getEventDetail('tasting', 'u1');

    const call = vi.mocked(db.experience.findFirst).mock.calls[0]?.[0];
    const includedStatuses = (
      call as unknown as {
        select: { bookings: { where: { status: { in: BookingStatus[] } } } };
      }
    ).select.bookings.where.status.in;
    expect(includedStatuses).not.toContain(BookingStatus.PENDING_PAYMENT);
    expect(includedStatuses).toContain(BookingStatus.CONFIRMED);
    expect(includedStatuses).toContain(BookingStatus.COMPLETED);
    expect(includedStatuses).toContain(BookingStatus.NO_SHOW);
  });

  it('isFull reflects confirmedSeats >= maxCapacity', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      ...baseExperience,
      maxCapacity: 4,
      bookings: [
        makeBooking({
          id: '1',
          status: BookingStatus.CONFIRMED,
          date: '2026-06-12',
          timeSlot: '14:00',
          guestCount: 4,
        }),
      ],
    } as never);

    const result = await getEventDetail('tasting', 'u1');

    expect(result!.sessions[0]!.isFull).toBe(true);
  });
});
