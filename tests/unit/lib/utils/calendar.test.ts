import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateICalEvent,
  generateGoogleCalendarUrl,
  createBookingCalendarEvent,
  type CalendarEventData,
} from '@/lib/utils/calendar';

describe('Calendar Utils', () => {
  const baseEvent: CalendarEventData = {
    title: 'Wine Tasting at Domain Example',
    description: 'A wonderful wine experience',
    location: '123 Vineyard Road, Sion, Switzerland',
    startDate: new Date(2026, 2, 15, 14, 0, 0), // March 15, 2026, 2:00 PM
    durationMinutes: 90,
    url: 'https://encave.ch/booking/test-123',
  };

  describe('generateICalEvent', () => {
    it('generates valid iCal content', () => {
      const result = generateICalEvent(baseEvent);

      expect(result).not.toBeNull();
      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('END:VEVENT');
      expect(result).toContain('Wine Tasting at Domain Example');
    });

    it('includes event location', () => {
      const result = generateICalEvent(baseEvent);

      expect(result).toContain('Sion');
      expect(result).toContain('Vineyard');
    });

    it('includes event URL when provided', () => {
      const result = generateICalEvent(baseEvent);

      expect(result).toContain('encave.ch');
    });

    it('generates event without URL', () => {
      const eventWithoutUrl = { ...baseEvent, url: undefined };
      const result = generateICalEvent(eventWithoutUrl);

      expect(result).not.toBeNull();
      expect(result).toContain('BEGIN:VEVENT');
    });

    it('sets event status to CONFIRMED', () => {
      const result = generateICalEvent(baseEvent);

      expect(result).toContain('STATUS:CONFIRMED');
    });
  });

  describe('generateGoogleCalendarUrl', () => {
    it('generates valid Google Calendar URL', () => {
      const url = generateGoogleCalendarUrl(baseEvent);

      expect(url).toContain('calendar.google.com/calendar/render');
      expect(url).toContain('action=TEMPLATE');
    });

    it('includes event title in URL', () => {
      const url = generateGoogleCalendarUrl(baseEvent);

      // URLSearchParams encodes spaces as +
      expect(url).toContain('Wine+Tasting+at+Domain+Example');
    });

    it('includes location in URL', () => {
      const url = generateGoogleCalendarUrl(baseEvent);

      // URLSearchParams encodes spaces as +
      expect(url).toContain('123+Vineyard+Road');
      expect(url).toContain('Sion');
    });

    it('formats dates correctly for Google Calendar', () => {
      const url = generateGoogleCalendarUrl(baseEvent);

      // Should contain date in format YYYYMMDDTHHmmss
      expect(url).toContain('dates=');
      // March 15, 2026, 14:00 = 20260315T140000
      expect(url).toContain('20260315T140000');
    });

    it('includes URL in description when provided', () => {
      const url = generateGoogleCalendarUrl(baseEvent);

      // URLSearchParams encodes differently than encodeURIComponent
      expect(url).toContain('More+info');
      expect(url).toContain('encave.ch');
    });
  });

  describe('createBookingCalendarEvent', () => {
    const bookingData = {
      experienceTitle: 'Grand Cru Tasting',
      wineryName: 'Domaine du Soleil',
      wineryAddress: 'Route des Vignes 45',
      wineryCommune: 'Sierre',
      date: new Date(Date.UTC(2026, 5, 20)), // June 20, 2026 (UTC midnight, like @db.Date)
      timeSlot: '10:30',
      durationMinutes: 120,
      guestCount: 4,
      reference: 'ENC-ABC123',
      bookingUrl: 'https://encave.ch/booking/xyz',
    };

    it('creates event with correct title', () => {
      const event = createBookingCalendarEvent(bookingData);

      expect(event.title).toBe('Grand Cru Tasting - Domaine du Soleil');
    });

    it('creates event with correct location', () => {
      const event = createBookingCalendarEvent(bookingData);

      expect(event.location).toBe('Route des Vignes 45, Sierre');
    });

    it('encodes the Zurich wall-clock as the correct UTC instant', () => {
      const event = createBookingCalendarEvent(bookingData);

      // 10:30 Europe/Zurich on 2026-06-20 (CEST, UTC+2) === 08:30 UTC. The
      // event carries the absolute instant so calendars render 10:30 for a
      // Zurich guest regardless of the server/viewer timezone (was previously
      // stamped as 10:30 UTC — 2h off).
      expect(event.startDate.toISOString()).toBe('2026-06-20T08:30:00.000Z');
    });

    it('sets correct duration', () => {
      const event = createBookingCalendarEvent(bookingData);

      expect(event.durationMinutes).toBe(120);
    });

    it('includes booking reference in description', () => {
      const event = createBookingCalendarEvent(bookingData);

      expect(event.description).toContain('ENC-ABC123');
    });

    it('includes guest count in description', () => {
      const event = createBookingCalendarEvent(bookingData);

      expect(event.description).toContain('4');
    });

    it('includes booking URL when provided', () => {
      const event = createBookingCalendarEvent(bookingData);

      expect(event.url).toBe('https://encave.ch/booking/xyz');
    });

    it('works without booking URL', () => {
      const eventWithoutUrl = { ...bookingData, bookingUrl: undefined };
      const event = createBookingCalendarEvent(eventWithoutUrl);

      expect(event.url).toBeUndefined();
    });
  });
});
