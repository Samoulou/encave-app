/**
 * Time slot constants for availability configuration
 */

// Generate 30-minute increments from 08:00 to 20:00
export const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});
// ['08:00', '08:30', '09:00', ... '20:00']

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', shortLabel: 'Sun' },
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
] as const;

// Start week on Monday for European convention
export const DAYS_OF_WEEK_ORDERED = [
  DAYS_OF_WEEK[1], // Monday
  DAYS_OF_WEEK[2], // Tuesday
  DAYS_OF_WEEK[3], // Wednesday
  DAYS_OF_WEEK[4], // Thursday
  DAYS_OF_WEEK[5], // Friday
  DAYS_OF_WEEK[6], // Saturday
  DAYS_OF_WEEK[0], // Sunday
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]['value'];

/**
 * Calculate end time based on start time and duration
 */
export function calculateEndTime(
  startTime: string,
  durationMinutes: number
): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = (hours ?? 0) * 60 + (minutes ?? 0) + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

/**
 * Check if two time slots overlap
 */
export function doSlotsOverlap(
  slot1: { startTime: string; endTime: string },
  slot2: { startTime: string; endTime: string }
): boolean {
  return slot1.startTime < slot2.endTime && slot2.startTime < slot1.endTime;
}

/**
 * Check if any slots in the array overlap with each other
 */
export function hasOverlappingSlots(
  slots: { startTime: string; endTime: string }[]
): boolean {
  const sorted = [...slots].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev && curr && curr.startTime < prev.endTime) {
      return true;
    }
  }
  return false;
}

/**
 * Format time for display in 24-hour format (e.g., "09:00" -> "09:00")
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const h = hours ?? 0;
  const m = minutes ?? 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
