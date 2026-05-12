import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { revalidateTag } from 'next/cache';
import { logInfo } from '@/lib/logger';
import { BookingStatus } from '@prisma/client';
import {
  markBookingCheckedIn,
  markBookingNoShow,
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

const baseBooking = {
  id: 'booking-1',
  guestCount: 2,
  experience: {
    id: 'exp-1',
    slug: 'tasting',
    winery: { id: 'winery-1', userId: 'user-owner' },
  },
};

const baseUpdated = {
  id: 'booking-1',
  reference: 'ENC-ABCDEF',
  visitorName: 'Alice',
  visitorEmail: 'alice@test.ch',
  visitorPhone: '+41 79 000 00 00',
  guestCount: 2,
  status: BookingStatus.COMPLETED,
  checkedInAt: new Date('2026-05-12T10:00:00Z'),
  createdAt: new Date('2026-04-01T10:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('markBookingCheckedIn', () => {
  it('returns UNAUTHORIZED when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await markBookingCheckedIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR when input is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await markBookingCheckedIn({ bookingId: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns FORBIDDEN when caller does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.CONFIRMED,
      experience: {
        ...baseBooking.experience,
        winery: { id: 'winery-1', userId: 'other-user' },
      },
    } as never);

    const result = await markBookingCheckedIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns NOT_FOUND when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue(null);

    const result = await markBookingCheckedIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('rejects non-CONFIRMED bookings', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.COMPLETED,
    } as never);

    const result = await markBookingCheckedIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('happy path: updates status, invalidates caches, returns DTO', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique)
      .mockResolvedValueOnce({
        ...baseBooking,
        status: BookingStatus.CONFIRMED,
      } as never)
      .mockResolvedValueOnce(baseUpdated as never);
    vi.mocked(db.booking.update).mockResolvedValue(baseUpdated as never);

    const result = await markBookingCheckedIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(true);
    expect(db.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          status: BookingStatus.COMPLETED,
        }),
      })
    );
    expect(revalidateTag).toHaveBeenCalledWith('event-detail:tasting');
    expect(revalidateTag).toHaveBeenCalledWith(
      'winery-user:user-owner:bookings'
    );
  });
});

describe('markBookingNoShow', () => {
  it('returns UNAUTHORIZED when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await markBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR when input is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await markBookingNoShow({ bookingId: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_FOUND when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue(null);

    const result = await markBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns FORBIDDEN when caller does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.CONFIRMED,
      experience: {
        ...baseBooking.experience,
        winery: { id: 'winery-1', userId: 'other-user' },
      },
    } as never);

    const result = await markBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects non-CONFIRMED bookings', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.NO_SHOW,
    } as never);

    const result = await markBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('happy path: transitions CONFIRMED → NO_SHOW (no past-time guard)', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique)
      .mockResolvedValueOnce({
        ...baseBooking,
        status: BookingStatus.CONFIRMED,
      } as never)
      .mockResolvedValueOnce({
        ...baseUpdated,
        status: BookingStatus.NO_SHOW,
        checkedInAt: null,
      } as never);
    vi.mocked(db.booking.update).mockResolvedValue({} as never);

    const result = await markBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(true);
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.NO_SHOW },
    });
  });
});

describe('revertBookingCheckIn', () => {
  it('returns UNAUTHORIZED when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await revertBookingCheckIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR when input is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await revertBookingCheckIn({ bookingId: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_FOUND when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue(null);

    const result = await revertBookingCheckIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns FORBIDDEN when caller does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.COMPLETED,
      experience: {
        ...baseBooking.experience,
        winery: { id: 'winery-1', userId: 'other-user' },
      },
    } as never);

    const result = await revertBookingCheckIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects non-COMPLETED bookings', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.CONFIRMED,
    } as never);

    const result = await revertBookingCheckIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('happy path: reverts COMPLETED → CONFIRMED and logs the action', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique)
      .mockResolvedValueOnce({
        ...baseBooking,
        status: BookingStatus.COMPLETED,
      } as never)
      .mockResolvedValueOnce({
        ...baseUpdated,
        status: BookingStatus.CONFIRMED,
        checkedInAt: null,
      } as never);
    vi.mocked(db.booking.update).mockResolvedValue({} as never);

    const result = await revertBookingCheckIn({ bookingId: 'booking-1' });

    expect(result.success).toBe(true);
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        status: BookingStatus.CONFIRMED,
        checkedInAt: null,
      },
    });
    expect(logInfo).toHaveBeenCalledWith(
      'booking.revert.checkin',
      expect.objectContaining({
        bookingId: 'booking-1',
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

    const result = await revertBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns VALIDATION_ERROR when input is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    const result = await revertBookingNoShow({ bookingId: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns NOT_FOUND when booking does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue(null);

    const result = await revertBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns FORBIDDEN when caller does not own the booking', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.NO_SHOW,
      experience: {
        ...baseBooking.experience,
        winery: { id: 'winery-1', userId: 'other-user' },
      },
    } as never);

    const result = await revertBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects non-NO_SHOW bookings', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.CONFIRMED,
    } as never);

    const result = await revertBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('happy path: reverts NO_SHOW → CONFIRMED and logs the action', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(db.booking.findUnique)
      .mockResolvedValueOnce({
        ...baseBooking,
        status: BookingStatus.NO_SHOW,
      } as never)
      .mockResolvedValueOnce({
        ...baseUpdated,
        status: BookingStatus.CONFIRMED,
        checkedInAt: null,
      } as never);
    vi.mocked(db.booking.update).mockResolvedValue({} as never);

    const result = await revertBookingNoShow({ bookingId: 'booking-1' });

    expect(result.success).toBe(true);
    expect(logInfo).toHaveBeenCalledWith(
      'booking.revert.noshow',
      expect.objectContaining({
        bookingId: 'booking-1',
        actorId: 'user-owner',
        from: BookingStatus.NO_SHOW,
        to: BookingStatus.CONFIRMED,
      })
    );
  });
});
