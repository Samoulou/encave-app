import type { BookingStatus } from '@prisma/client';

/**
 * DTOs for the winemaker day-J booking actions (ENC-096, re-homed on the
 * occurrence calendar sheet in P-05).
 *
 * The session-grouping DTOs (EventSessionDTO, EventDetailDTO…) were
 * deleted with `getEventDetail` when the sessions route was repointed
 * onto the occurrence calendar — sessions are occurrence-authoritative
 * now (see OccurrenceCalendarEntryDTO in occurrence.queries.ts).
 */

/**
 * Booking projection returned by the day-J server actions
 * (src/server/actions/event-detail.ts).
 * nLPD minimisation: visitor phone is intentionally excluded — the flows
 * only offer a mailto: contact via `visitorEmail`. Do not stream this DTO
 * to any client that is not the winery owner.
 */
export interface BookingDTO {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  guestCount: number;
  status: BookingStatus;
  checkedInAt: Date | null;
  createdAt: Date;
}
