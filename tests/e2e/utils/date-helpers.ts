/**
 * Date helper utilities for E2E tests
 *
 * These helpers assist with date manipulation for booking tests,
 * ensuring we always work with valid future dates.
 */

/**
 * Get a date string in YYYY-MM-DD format
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getToday(): string {
  return formatDateString(new Date());
}

/**
 * Get a date N days from today
 */
export function getDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}

/**
 * Get tomorrow's date
 */
export function getTomorrow(): string {
  return getDaysFromNow(1);
}

/**
 * Get a date N weeks from today
 */
export function getWeeksFromNow(weeks: number): string {
  return getDaysFromNow(weeks * 7);
}

/**
 * Get the next occurrence of a specific day of the week
 *
 * @param dayOfWeek - 0 (Sunday) to 6 (Saturday)
 * @param skipThisWeek - If true, skips to next week even if today matches
 */
export function getNextDayOfWeek(
  dayOfWeek: number,
  skipThisWeek: boolean = true
): string {
  const date = new Date();
  const currentDay = date.getDay();

  let daysToAdd = dayOfWeek - currentDay;

  if (daysToAdd <= 0 || (daysToAdd === 0 && skipThisWeek)) {
    daysToAdd += 7;
  }

  date.setDate(date.getDate() + daysToAdd);
  return formatDateString(date);
}

/**
 * Get the next Monday
 */
export function getNextMonday(): string {
  return getNextDayOfWeek(1);
}

/**
 * Get the next Friday
 */
export function getNextFriday(): string {
  return getNextDayOfWeek(5);
}

/**
 * Get a weekday (Mon-Fri) at least N days from now
 */
export function getNextWeekday(minDaysAhead: number = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + minDaysAhead);

  // If it's Saturday, move to Monday
  if (date.getDay() === 6) {
    date.setDate(date.getDate() + 2);
  }
  // If it's Sunday, move to Monday
  else if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }

  return formatDateString(date);
}

/**
 * Get the day of month from a date string
 */
export function getDayOfMonth(dateString: string): number {
  return new Date(dateString).getDate();
}

/**
 * Get the month name from a date string
 */
export function getMonthName(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', { month: 'long' });
}

/**
 * Get the year from a date string
 */
export function getYear(dateString: string): number {
  return new Date(dateString).getFullYear();
}

/**
 * Format a date for display (e.g., "Monday, January 20, 2026")
 */
export function formatDisplayDate(
  dateString: string,
  locale: string = 'en-US'
): string {
  return new Date(dateString).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if a date is today
 */
export function isToday(dateString: string): boolean {
  return dateString === getToday();
}

/**
 * Check if a date is within the booking window (e.g., 3 months)
 */
export function isWithinBookingWindow(
  dateString: string,
  windowMonths: number = 3
): boolean {
  const date = new Date(dateString);
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + windowMonths);

  return date <= maxDate && !isPastDate(dateString);
}

/**
 * Get a date that is within 24 hours (for testing no-refund scenarios)
 */
export function getDateWithin24Hours(): { date: string; time: string } {
  const now = new Date();

  // If it's early enough in the day, use today
  if (now.getHours() < 20) {
    return {
      date: getToday(),
      time: `${(now.getHours() + 2).toString().padStart(2, '0')}:00`,
    };
  }

  // Otherwise use tomorrow morning
  return {
    date: getTomorrow(),
    time: '10:00',
  };
}

/**
 * Get a date that is more than 24 hours away (for testing refund-eligible scenarios)
 */
export function getDateBeyond24Hours(): { date: string; time: string } {
  return {
    date: getDaysFromNow(3), // 3 days from now is safely beyond 24 hours
    time: '10:00',
  };
}

/**
 * Parse a time string (e.g., "10:00 AM") to 24-hour format (e.g., "10:00")
 */
export function parseTimeTo24Hour(timeString: string): string {
  // Already in 24-hour format
  if (
    !timeString.toLowerCase().includes('am') &&
    !timeString.toLowerCase().includes('pm')
  ) {
    return timeString;
  }

  const [time, period] = timeString.split(' ');
  let [hours, minutes] = time.split(':').map(Number);

  if (period.toLowerCase() === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period.toLowerCase() === 'am' && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Format time to AM/PM (e.g., "10:00" -> "10:00 AM")
 */
export function formatTimeToAMPM(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Generate a random valid booking date and time
 */
export function getRandomBookingDateTime(): { date: string; time: string } {
  // Random weekday 7-30 days from now
  const daysAhead = 7 + Math.floor(Math.random() * 23);
  let date = new Date();
  date.setDate(date.getDate() + daysAhead);

  // Ensure it's a weekday
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  // Random time between 10:00 and 17:00
  const hour = 10 + Math.floor(Math.random() * 8);
  const time = `${hour.toString().padStart(2, '0')}:00`;

  return {
    date: formatDateString(date),
    time,
  };
}
