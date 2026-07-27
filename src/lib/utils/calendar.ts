import { createEvent, type EventAttributes } from 'ics';
import { addMinutes } from 'date-fns';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';

export interface CalendarEventData {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  durationMinutes: number;
  url?: string;
}

/**
 * Generates an iCal (.ics) file content for a booking
 */
export function generateICalEvent(event: CalendarEventData): string | null {
  const startDate = event.startDate;
  const endDate = addMinutes(startDate, event.durationMinutes);

  const icsEvent: EventAttributes = {
    // startDate/endDate are absolute UTC instants; emit UTC components so
    // the calendar renders the correct Europe/Zurich time in any viewer TZ.
    // (Default ics inputType 'local' would re-stamp the wall-clock as UTC.)
    startInputType: 'utc',
    startOutputType: 'utc',
    endInputType: 'utc',
    endOutputType: 'utc',
    start: [
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + 1,
      startDate.getUTCDate(),
      startDate.getUTCHours(),
      startDate.getUTCMinutes(),
    ],
    end: [
      endDate.getUTCFullYear(),
      endDate.getUTCMonth() + 1,
      endDate.getUTCDate(),
      endDate.getUTCHours(),
      endDate.getUTCMinutes(),
    ],
    title: event.title,
    description: event.description,
    location: event.location,
    url: event.url,
    status: 'CONFIRMED',
    busyStatus: 'BUSY',
    organizer: { name: 'EnCave', email: 'noreply@encave.ch' },
    productId: 'encave/booking',
  };

  const result = createEvent(icsEvent);

  if (result.error) {
    // Error generating iCal event - return null to caller
    return null;
  }

  return result.value ?? null;
}

/**
 * Generates a Google Calendar URL for adding an event
 */
export function generateGoogleCalendarUrl(event: CalendarEventData): string {
  const startDate = event.startDate;
  const endDate = addMinutes(startDate, event.durationMinutes);

  // Google Calendar UTC format YYYYMMDDTHHmmssZ (startDate is a UTC instant).
  const formatForGoogle = (date: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}` +
      `${p(date.getUTCDate())}T${p(date.getUTCHours())}` +
      `${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
    );
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatForGoogle(startDate)}/${formatForGoogle(endDate)}`,
    details: event.description,
    location: event.location,
  });

  if (event.url) {
    params.set('details', `${event.description}\n\nMore info: ${event.url}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Triggers a file download of the iCal event
 */
export function downloadICalEvent(
  event: CalendarEventData,
  filename: string
): boolean {
  const icsContent = generateICalEvent(event);

  if (!icsContent) {
    return false;
  }

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}

/**
 * Creates calendar event data from a booking
 */
export function createBookingCalendarEvent(booking: {
  experienceTitle: string;
  wineryName: string;
  wineryAddress: string;
  wineryCommune: string;
  date: Date;
  timeSlot: string;
  durationMinutes: number;
  guestCount: number;
  reference: string;
  bookingUrl?: string;
}): CalendarEventData {
  // Combine the @db.Date (UTC-midnight) with the Europe/Zurich wall-clock
  // timeSlot into the true absolute UTC instant.
  const startDate = zonedWallClockToUTC(booking.date, booking.timeSlot);

  const location = `${booking.wineryAddress}, ${booking.wineryCommune}`;

  const description = [
    `Wine experience at ${booking.wineryName}`,
    '',
    `Experience: ${booking.experienceTitle}`,
    `Guests: ${booking.guestCount}`,
    `Reference: ${booking.reference}`,
  ].join('\n');

  return {
    title: `${booking.experienceTitle} - ${booking.wineryName}`,
    description,
    location,
    startDate,
    durationMinutes: booking.durationMinutes,
    url: booking.bookingUrl,
  };
}
