import { cache } from 'react';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import {
  COLLECTIVE_SOLD_STATUSES,
  eligibleParticipantWineryWhere,
} from '@/lib/business-rules/collective-events';

/**
 * Participant read-only view of collective events (P-11 / L-102).
 *
 * A participating winery does NOT own the event's bookings (they belong to
 * the organizer), so the tenant gate is PARTICIPATION, not ownership: the
 * caller's winery must be an `EventParticipant` of a PUBLISHED collective
 * experience AND itself eligible (VERIFIED, owner not suspended) — a suspended
 * winery sees nothing, matching WineryAccessGuard on every sibling dashboard
 * surface. The view is strictly read: sold/scanned aggregates + the attendee
 * roster. No financial figures. Per Sam's D-Visibilité decision the roster is
 * nominative (name + contact) — a cross-winery PII share to be covered by the
 * CGV (P-12/P-16).
 */

export interface ParticipantEventAttendeeDTO {
  bookingId: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  guestCount: number;
  date: Date;
  timeSlot: string;
  checkedInAt: Date | null;
  status: BookingStatus;
}

export interface ParticipantEventDTO {
  experienceId: string;
  title: string;
  slug: string;
  organizerWineryName: string;
  soldSeats: number;
  checkedInSeats: number;
  attendees: ParticipantEventAttendeeDTO[];
}

/**
 * True when the caller's winery participates in ≥1 PUBLISHED collective
 * event — drives the dashboard nav entry (cheap COUNT, no roster load).
 */
export const hasCollectiveParticipations = cache(
  async (userId: string): Promise<boolean> => {
    // Eligibility-gated: a suspended/unverified caller resolves to null, so
    // the nav entry hides — the query is no longer a bare id lookup.
    const winery = await db.winery.findFirst({
      where: { userId, ...eligibleParticipantWineryWhere },
      select: { id: true },
    });
    if (!winery) return false;

    const count = await db.eventParticipant.count({
      where: {
        wineryId: winery.id,
        experience: { isCollective: true, status: 'PUBLISHED' },
      },
    });
    return count > 0;
  }
);

/**
 * The collective events the caller's winery participates in, each with sold
 * and scanned seat totals + the (read-only) attendee roster.
 */
export const getParticipantCollectiveEvents = cache(
  async (userId: string): Promise<ParticipantEventDTO[]> => {
    // Tenant gate: the caller's winery must be eligible (VERIFIED, owner not
    // suspended). A suspended winery gets [] — it must never read the
    // organizer's attendee PII, consistent with the public grid gate.
    const winery = await db.winery.findFirst({
      where: { userId, ...eligibleParticipantWineryWhere },
      select: { id: true },
    });
    if (!winery) return [];

    const participations = await db.eventParticipant.findMany({
      where: {
        wineryId: winery.id,
        experience: { isCollective: true, status: 'PUBLISHED' },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        experience: {
          select: {
            id: true,
            title: true,
            slug: true,
            winery: { select: { name: true } },
          },
        },
      },
    });
    if (participations.length === 0) return [];

    // Dedupe (the unique [experienceId, wineryId] makes this 1:1, but the
    // map keeps event order + organizer name).
    const eventById = new Map(
      participations.map((p) => [p.experience.id, p.experience])
    );
    const experienceIds = Array.from(eventById.keys());

    const bookings = await db.booking.findMany({
      where: {
        experienceId: { in: experienceIds },
        status: { in: [...COLLECTIVE_SOLD_STATUSES] },
      },
      orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
      select: {
        id: true,
        experienceId: true,
        reference: true,
        visitorName: true,
        visitorEmail: true,
        guestCount: true,
        date: true,
        timeSlot: true,
        checkedInAt: true,
        status: true,
      },
    });

    const byExperience = new Map<string, ParticipantEventAttendeeDTO[]>();
    for (const booking of bookings) {
      const list = byExperience.get(booking.experienceId) ?? [];
      list.push({
        bookingId: booking.id,
        reference: booking.reference,
        visitorName: booking.visitorName,
        visitorEmail: booking.visitorEmail,
        guestCount: booking.guestCount,
        date: booking.date,
        timeSlot: booking.timeSlot,
        checkedInAt: booking.checkedInAt,
        status: booking.status,
      });
      byExperience.set(booking.experienceId, list);
    }

    return experienceIds.map((experienceId) => {
      const event = eventById.get(experienceId);
      const attendees = byExperience.get(experienceId) ?? [];
      const soldSeats = attendees.reduce((sum, a) => sum + a.guestCount, 0);
      const checkedInSeats = attendees
        .filter((a) => a.status === BookingStatus.COMPLETED)
        .reduce((sum, a) => sum + a.guestCount, 0);
      return {
        experienceId,
        title: event?.title ?? '',
        slug: event?.slug ?? '',
        organizerWineryName: event?.winery.name ?? '',
        soldSeats,
        checkedInSeats,
        attendees,
      };
    });
  }
);
