import { cache } from 'react';
import { db } from '@/server/db';
import { BookingStatus, type ExperienceType } from '@prisma/client';

/**
 * Convert a local date to UTC date, preserving the local date components.
 */
function localDateToUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export interface ClientBookingWithDetails {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  status: BookingStatus;
  cancelledAt: Date | null;
  refundIssued: boolean;
  refundAmount: number | null;
  createdAt: Date;
  experience: {
    id: string;
    title: string;
    slug: string;
    coverPhoto: string;
    duration: number;
    type: ExperienceType;
  };
  winery: {
    name: string;
    slug: string;
    address: string;
    commune: string | null;
    phone: string;
    email: string;
  };
}

const clientBookingSelect = {
  id: true,
  reference: true,
  visitorName: true,
  visitorEmail: true,
  visitorPhone: true,
  date: true,
  timeSlot: true,
  guestCount: true,
  totalPrice: true,
  status: true,
  cancelledAt: true,
  refundIssued: true,
  refundAmount: true,
  createdAt: true,
  experience: {
    select: {
      id: true,
      title: true,
      slug: true,
      coverPhoto: true,
      duration: true,
      type: true,
    },
  },
  winery: {
    select: {
      name: true,
      slug: true,
      address: true,
      commune: true,
      phone: true,
      email: true,
    },
  },
} as const;

/**
 * Get upcoming bookings for a client by email.
 * Upcoming = CONFIRMED and date >= today.
 */
export const getClientUpcomingBookings = cache(
  async function getClientUpcomingBookings(
    userEmail: string
  ): Promise<ClientBookingWithDetails[]> {
    const todayUTC = localDateToUTC(new Date());

    const bookings = await db.booking.findMany({
      where: {
        visitorEmail: { equals: userEmail, mode: 'insensitive' },
        status: BookingStatus.CONFIRMED,
        date: { gte: todayUTC },
      },
      orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
      select: clientBookingSelect,
    });

    return bookings;
  }
);

/**
 * Get past bookings for a client by email.
 * Past = date < today OR status in [COMPLETED, CANCELLED_BY_CLIENT, CANCELLED_BY_WINERY, NO_SHOW].
 * Excludes PENDING_PAYMENT.
 */
export const getClientPastBookings = cache(
  async function getClientPastBookings(
    userEmail: string
  ): Promise<ClientBookingWithDetails[]> {
    const todayUTC = localDateToUTC(new Date());

    const bookings = await db.booking.findMany({
      where: {
        visitorEmail: { equals: userEmail, mode: 'insensitive' },
        status: { not: BookingStatus.PENDING_PAYMENT },
        OR: [
          { date: { lt: todayUTC } },
          {
            status: {
              in: [
                BookingStatus.COMPLETED,
                BookingStatus.CANCELLED_BY_CLIENT,
                BookingStatus.CANCELLED_BY_WINERY,
                BookingStatus.NO_SHOW,
              ],
            },
          },
        ],
      },
      orderBy: [{ date: 'desc' }, { timeSlot: 'desc' }],
      select: clientBookingSelect,
    });

    return bookings;
  }
);
