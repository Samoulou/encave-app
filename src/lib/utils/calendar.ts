import { createEvent, type EventAttributes } from 'ics';
import { format, addMinutes } from 'date-fns';

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
    start: [
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      startDate.getDate(),
      startDate.getHours(),
      startDate.getMinutes(),
    ],
    end: [
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      endDate.getDate(),
      endDate.getHours(),
      endDate.getMinutes(),
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

  // Google Calendar format: YYYYMMDDTHHmmssZ
  const formatForGoogle = (date: Date) => format(date, "yyyyMMdd'T'HHmmss");

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
  // Parse the time slot (e.g., "14:00") and combine with date
  const [hours, minutes] = booking.timeSlot.split(':').map(Number);
  const startDate = new Date(booking.date);
  startDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);

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
