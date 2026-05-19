import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findFirst: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { revalidatePath, revalidateTag } from 'next/cache';
import { logInfo } from '@/lib/logger';
import { BookingStatus } from '@prisma/client';
import {
  markBookingCheckedIn,
  markBookingNoShow,
  getAttendeeEmailsForSession,
  revertBookingCheckIn,
  revertBookingNoShow,
} from '@/server/actions/event-detail';

const mockSession: Session = {
  user: {
    id: 'user-owner',
    email: 'enc@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
  },
};

// Valid cuid (matches Zod's /^[cC][^\s-]{8,}$/).
const VALID_BOOKING_ID = 'ckxyzabcdefghij1234567890';

/**
 * Shape returned by `resolveContext`'s `db.booking.findUnique` call.
 * Mirrors the inline `select` in src/server/actions/event-detail.ts.
 */
interface CtxBookingShape {
  id: string;
  status: BookingStatus;
  guestCount: number;
  date: Date;
  timeSlot: string;
  experience: {
    id: string;
    slug: string;
    duration: number;
    winery: { id: string; userId: string };
  };
}

/**
 * Shape returned by `loadBookingDTO`'s second `db.booking.findUnique` call.
 */
interface DtoBookingShape {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  guestCount: number;
  status: BookingStatus;
  checkedInAt: Date | null;
  createdAt: Date;
}

// Typed helpers — keep mocks strongly typed without resorting to `as any`/`as never`.
const findUniqueMock = vi.mocked(db.booking.findUnique);
const findManyMock = vi.mocked(db.booking.findMany);
const updateMock = vi.mocked(db.booking.update);
const findExperienceMock = vi.mocked(db.experience.findFirst);

function mockCtxBooking(overrides: Partial<CtxBookingShape> = {}): void {
  const recentPastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  recentPastDate.setUTCHours(0, 0, 0, 0);

  const value: CtxBookingShape = {
    id: VALID_BOOKING_ID,
    status: BookingStatus.CONFIRMED,
    guestCount: 2,
    // A session that ended well in the past so the noShow + revert guards pass
    // by default. Individual tests override `date` to flip the time-window.
    date: recentPastDate,
    timeSlot: '10:00',
    experience: {
      id: 'exp-1',
      slug: 'tasting',
      duration: 60,
      winery: { id: 'winery-1', userId: 'user-owner' },
    },
    ...overrides,
  };
  // Cast happens once, here — keeps the test bodies type-clean and grep-friendly.
  findUniqueMock.mockResolvedValueOnce(
    value as unknown as Awaited<ReturnType<typeof db.booking.findUnique>>
  );
}

function mockUpdatedDto(overrides: Partial<DtoBookingShape> = {}): void {
  const value: DtoBookingShape = {
    id: VALID_BOOKING_ID,
    reference: 'ENC-ABCDEF',
    visitorName: 'Alice',
    visitorEmail: 'alice@test.ch',
    guestCount: 2,
    status: BookingStatus.COMPLETED,
    checkedInAt: new Date('2026-05-12T10:00:00Z'),
    createdAt: new Date('2026-04-01T10:00:00Z'),
    ...overrides,
  };
  findUniqueMock.mockResolvedValueOnce(
    value as unknown as Awaited<ReturnType<typeof db.booking.findUnique>>
  );
}

function mockFindUniqueNull(): void {
  findUniqueMock.mockResolvedValueOnce(null);
}

function mockUpdateNoop(): void {
  updateMock.mockResolvedValueOnce(
    {} as unknown as Awaited<ReturnType<typeof db.booking.update>>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('markBookingCheckedIn', () => {
  it('returns UNAUTHORIZED when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await markBookingCheckedIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR when input is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await markBookingCheckedIn({ bookingId: 'not-a-cuid' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns FORBIDDEN when caller does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({
      experience: {
        id: 'exp-1',
        slug: 'tasting',
        duration: 60,
        winery: { id: 'winery-1', userId: 'other-user' },
      },
    });

    const result = await markBookingCheckedIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns NOT_FOUND when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockFindUniqueNull();

    const result = await markBookingCheckedIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('rejects non-CONFIRMED bookings', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({ status: BookingStatus.COMPLETED });

    const result = await markBookingCheckedIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('happy path: updates status, invalidates caches, returns DTO', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({ status: BookingStatus.CONFIRMED });
    mockUpdateNoop();
    mockUpdatedDto();

    const result = await markBookingCheckedIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(true);
    expect(db.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_BOOKING_ID },
        data: expect.objectContaining({
          status: BookingStatus.COMPLETED,
        }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
  });
});

describe('markBookingNoShow', () => {
  it('returns UNAUTHORIZED when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await markBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR when input is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await markBookingNoShow({ bookingId: 'not-a-cuid' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_FOUND when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockFindUniqueNull();

    const result = await markBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns FORBIDDEN when caller does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({
      experience: {
        id: 'exp-1',
        slug: 'tasting',
        duration: 60,
        winery: { id: 'winery-1', userId: 'other-user' },
      },
    });

    const result = await markBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects non-CONFIRMED bookings', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({ status: BookingStatus.NO_SHOW });

    const result = await markBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects when the session has not ended yet (SESSION_NOT_ENDED)', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    // A session scheduled far in the future → endsAt > now.
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    future.setUTCHours(0, 0, 0, 0);
    mockCtxBooking({ date: future, timeSlot: '10:00' });

    const result = await markBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('SESSION_NOT_ENDED');
    }
    expect(db.booking.update).not.toHaveBeenCalled();
  });

  it('happy path: transitions CONFIRMED → NO_SHOW once the session has ended', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({ status: BookingStatus.CONFIRMED });
    mockUpdateNoop();
    mockUpdatedDto({ status: BookingStatus.NO_SHOW, checkedInAt: null });

    const result = await markBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(true);
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: VALID_BOOKING_ID },
      data: { status: BookingStatus.NO_SHOW },
    });
  });
});

describe('revertBookingCheckIn', () => {
  it('returns UNAUTHORIZED when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await revertBookingCheckIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR when input is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await revertBookingCheckIn({ bookingId: 'not-a-cuid' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_FOUND when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockFindUniqueNull();

    const result = await revertBookingCheckIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns FORBIDDEN when caller does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({
      status: BookingStatus.COMPLETED,
      experience: {
        id: 'exp-1',
        slug: 'tasting',
        duration: 60,
        winery: { id: 'winery-1', userId: 'other-user' },
      },
    });

    const result = await revertBookingCheckIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects non-COMPLETED bookings', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({ status: BookingStatus.CONFIRMED });

    const result = await revertBookingCheckIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects revert after 72h window (REVERT_WINDOW_EXPIRED)', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    // Session that ended ~5 days ago → outside the 72h window.
    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    old.setUTCHours(0, 0, 0, 0);
    mockCtxBooking({
      status: BookingStatus.COMPLETED,
      date: old,
      timeSlot: '10:00',
    });

    const result = await revertBookingCheckIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('REVERT_WINDOW_EXPIRED');
    }
    expect(db.booking.update).not.toHaveBeenCalled();
  });

  it('happy path: reverts COMPLETED → CONFIRMED and logs the action', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({ status: BookingStatus.COMPLETED });
    mockUpdateNoop();
    mockUpdatedDto({ status: BookingStatus.CONFIRMED, checkedInAt: null });

    const result = await revertBookingCheckIn({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(true);
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: VALID_BOOKING_ID },
      data: {
        status: BookingStatus.CONFIRMED,
        checkedInAt: null,
      },
    });
    expect(logInfo).toHaveBeenCalledWith(
      'booking.revert.checkin',
      expect.objectContaining({
        bookingId: VALID_BOOKING_ID,
        actorId: 'user-owner',
        from: BookingStatus.COMPLETED,
        to: BookingStatus.CONFIRMED,
      })
    );
  });
});

describe('revertBookingNoShow', () => {
  it('returns UNAUTHORIZED when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await revertBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR when input is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await revertBookingNoShow({ bookingId: 'not-a-cuid' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_FOUND when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockFindUniqueNull();

    const result = await revertBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns FORBIDDEN when caller does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({
      status: BookingStatus.NO_SHOW,
      experience: {
        id: 'exp-1',
        slug: 'tasting',
        duration: 60,
        winery: { id: 'winery-1', userId: 'other-user' },
      },
    });

    const result = await revertBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects non-NO_SHOW bookings', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({ status: BookingStatus.CONFIRMED });

    const result = await revertBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects revert after 72h window (REVERT_WINDOW_EXPIRED)', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    old.setUTCHours(0, 0, 0, 0);
    mockCtxBooking({
      status: BookingStatus.NO_SHOW,
      date: old,
      timeSlot: '10:00',
    });

    const result = await revertBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('REVERT_WINDOW_EXPIRED');
    }
    expect(db.booking.update).not.toHaveBeenCalled();
  });

  it('happy path: reverts NO_SHOW → CONFIRMED and logs the action', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    mockCtxBooking({ status: BookingStatus.NO_SHOW });
    mockUpdateNoop();
    mockUpdatedDto({ status: BookingStatus.CONFIRMED, checkedInAt: null });

    const result = await revertBookingNoShow({ bookingId: VALID_BOOKING_ID });

    expect(result.success).toBe(true);
    expect(logInfo).toHaveBeenCalledWith(
      'booking.revert.noshow',
      expect.objectContaining({
        bookingId: VALID_BOOKING_ID,
        actorId: 'user-owner',
        from: BookingStatus.NO_SHOW,
        to: BookingStatus.CONFIRMED,
      })
    );
  });
});

describe('getAttendeeEmailsForSession', () => {
  const input = {
    experienceId: 'ckexperienceabcdefghij123456',
    sessionId: '2026-05-20|14:00',
  };

  it('returns UNAUTHORIZED when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await getAttendeeEmailsForSession(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR for malformed session input', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await getAttendeeEmailsForSession({
      experienceId: 'not-a-cuid',
      sessionId: 'bad',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_FOUND when the experience does not belong to the caller', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    findExperienceMock.mockResolvedValueOnce(null);

    const result = await getAttendeeEmailsForSession(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('returns deduplicated confirmed attendee emails only', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    findExperienceMock.mockResolvedValueOnce({
      id: input.experienceId,
    } as unknown as Awaited<ReturnType<typeof db.experience.findFirst>>);
    findManyMock.mockResolvedValueOnce([
      { visitorEmail: ' Alice@Test.ch ' },
      { visitorEmail: 'alice@test.ch' },
      { visitorEmail: 'bad-email' },
      { visitorEmail: 'bob@test.ch' },
    ] as unknown as Awaited<ReturnType<typeof db.booking.findMany>>);

    const result = await getAttendeeEmailsForSession(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        to: 'enc@test.ch',
        emails: ['alice@test.ch', 'bob@test.ch'],
      });
    }
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          experienceId: input.experienceId,
          timeSlot: '14:00',
          status: BookingStatus.CONFIRMED,
        }),
        select: { visitorEmail: true },
      })
    );
  });
});
