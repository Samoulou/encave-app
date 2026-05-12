import type {
  BookingStatus,
  ExperienceStatus,
  ExperienceType,
} from '@prisma/client';

/**
 * DTOs for the winemaker event detail page (ENC-096).
 *
 * The "session" concept is derived in memory from
 * (Booking.experienceId, Booking.date, Booking.timeSlot) tuples — there is no
 * ExperienceSession model in the DB. See docs/specs/ENC-096.md and
 * Margot's decisions actées (2026-05-12).
 */

export type SessionGroup = 'today' | 'upcoming' | 'past' | 'cancelled';

export interface BookingDTO {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  guestCount: number;
  status: BookingStatus;
  checkedInAt: Date | null;
  createdAt: Date;
}

export interface EventSessionDTO {
  /** Stable identifier "{ISO date}|{HH:mm}" for the (date, timeSlot) pair. */
  sessionId: string;
  /** Date-only (midnight UTC) — combine with timeSlot for absolute instants. */
  date: Date;
  /** "HH:mm" local (Europe/Zurich) start time. */
  timeSlot: string;
  /** Computed in the query: start instant in UTC for the timeSlot at date. */
  startsAt: Date;
  /** Computed in the query: end instant (startsAt + experience.duration). */
  endsAt: Date;
  /** All non-PENDING_PAYMENT bookings for this session. */
  bookings: BookingDTO[];
  /** Total guestCount for CONFIRMED + COMPLETED + NO_SHOW. */
  confirmedSeats: number;
  /** experience.maxCapacity copy for convenience. */
  totalCapacity: number;
  /** True when confirmedSeats >= totalCapacity. */
  isFull: boolean;
  /** Bucket assigned by the query (today/upcoming/past/cancelled). */
  group: SessionGroup;
}

export interface EventDetailExperienceDTO {
  id: string;
  title: string;
  slug: string;
  type: ExperienceType;
  status: ExperienceStatus;
  duration: number; // minutes
  maxCapacity: number;
  winery: {
    id: string;
    slug: string;
    name: string;
  };
}

export interface EventDetailDTO {
  experience: EventDetailExperienceDTO;
  /** Sessions grouped/ordered by the query — today first, then upcoming asc, past desc. */
  sessions: EventSessionDTO[];
  /** Sum of confirmedSeats across non-past, non-cancelled sessions. */
  totalConfirmedSeats: number;
  /** Sum of totalCapacity across non-past, non-cancelled sessions. */
  totalActiveCapacity: number;
  /** Number of non-past, non-cancelled sessions. */
  activeSessionsCount: number;
}
