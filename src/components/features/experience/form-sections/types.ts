export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface AvailabilitySlot {
  id: string;
  days: DayOfWeek[];
  timeSlots: { start: string; end: string }[];
}

export interface GalleryImage {
  id: string;
  url: string;
  order: number;
  isCover?: boolean;
}

export interface AddressData {
  street: string;
  city: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  fullAddress: string;
}

// Experience type options with icons
export const EXPERIENCE_TYPES = [
  { value: 'TASTING', label: 'Tasting' },
  { value: 'VINEYARD_TOUR', label: 'Tour' },
  { value: 'FOOD_PAIRING', label: 'Dinner' },
  { value: 'WORKSHOP', label: 'Class' },
] as const;

// Days of week
export const DAYS_OF_WEEK = [
  { value: 'MON' as DayOfWeek, label: 'Mon' },
  { value: 'TUE' as DayOfWeek, label: 'Tue' },
  { value: 'WED' as DayOfWeek, label: 'Wed' },
  { value: 'THU' as DayOfWeek, label: 'Thu' },
  { value: 'FRI' as DayOfWeek, label: 'Fri' },
  { value: 'SAT' as DayOfWeek, label: 'Sat' },
  { value: 'SUN' as DayOfWeek, label: 'Sun' },
] as const;
