/**
 * Test Data Definitions and Factories
 *
 * This file contains type definitions and factory functions for creating
 * test data used in E2E tests.
 */

import { getNextWeekday, getDaysFromNow } from '../utils/date-helpers';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Experience types matching the application
 */
export type ExperienceType =
  | 'TASTING'
  | 'CELLAR_VISIT'
  | 'WORKSHOP'
  | 'VINEYARD_TOUR'
  | 'FOOD_PAIRING';

/**
 * Booking status types
 */
export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED_BY_CLIENT'
  | 'CANCELLED_BY_HOST'
  | 'COMPLETED';

/**
 * Day of week (0 = Sunday, 6 = Saturday)
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Winery test data structure
 */
export interface TestWinery {
  id: string;
  name: string;
  slug: string;
  description: string;
  commune: string;
  address: string;
  phone: string;
  email: string;
  stripeConnected: boolean;
  stripeAccountId?: string;
  userId: string;
}

/**
 * Availability slot structure
 */
export interface AvailabilitySlot {
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

/**
 * Experience test data structure
 */
export interface TestExperience {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ExperienceType;
  price: number; // in cents (e.g., 5000 = CHF 50)
  minCapacity: number;
  maxCapacity: number;
  duration: number; // minutes
  coverPhoto: string;
  wineryId: string;
  availabilitySlots: AvailabilitySlot[];
}

/**
 * Visitor data structure (for checkout)
 */
export interface TestVisitor {
  name: string;
  email: string;
  phone: string;
}

/**
 * Booking test data structure
 */
export interface TestBooking {
  id: string;
  reference: string; // EC-XXXXXXXX format
  accessToken: string;
  status: BookingStatus;
  experienceId: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // HH:mm
  guestCount: number;
  totalAmount: number; // in cents
  visitor: TestVisitor;
}

// ============================================================
// STATIC TEST DATA
// ============================================================

/**
 * Pre-defined test users (winemakers)
 */
export const TEST_USERS = {
  activeWineryOwner: {
    id: 'test-user-active-winery',
    email: 'winemaker@domaine-du-test.ch',
    name: 'Jean Vigneron',
  },
  inactiveWineryOwner: {
    id: 'test-user-inactive-winery',
    email: 'winemaker@sans-stripe.ch',
    name: 'Pierre Caviste',
  },
  secondaryWineryOwner: {
    id: 'test-user-secondary-winery',
    email: 'winemaker@cave-tests.ch',
    name: 'Marie Viticultrice',
  },
};

/**
 * Pre-defined test wineries
 */
export const TEST_WINERIES: Record<string, TestWinery> = {
  /** Winery with Stripe connected - can accept bookings */
  activeWinery: {
    id: 'test-winery-active',
    name: 'Domaine du Test',
    slug: 'domaine-du-test',
    description:
      'Un domaine viticole familial au cœur de Lausanne, produisant des vins exceptionnels depuis trois générations.',
    commune: 'Lausanne',
    address: '123 Rue de Test, 1000 Lausanne',
    phone: '+41 21 123 45 67',
    email: 'contact@domaine-du-test.ch',
    stripeConnected: true,
    stripeAccountId: 'acct_test_active',
    userId: TEST_USERS.activeWineryOwner.id,
  },

  /** Winery without Stripe - shows Coming Soon */
  inactiveWinery: {
    id: 'test-winery-inactive',
    name: 'Domaine Sans Stripe',
    slug: 'domaine-sans-stripe',
    description:
      'Cave traditionnelle genevoise spécialisée dans les cépages autochtones.',
    commune: 'Geneva',
    address: '456 Avenue du Vin, 1200 Genève',
    phone: '+41 22 987 65 43',
    email: 'info@sans-stripe.ch',
    stripeConnected: false,
    userId: TEST_USERS.inactiveWineryOwner.id,
  },

  /** Secondary active winery for related experiences */
  secondaryWinery: {
    id: 'test-winery-secondary',
    name: 'Cave des Tests',
    slug: 'cave-des-tests',
    description:
      'Une cave moderne à Montreux offrant des expériences œnologiques uniques avec vue sur le lac.',
    commune: 'Montreux',
    address: '789 Chemin du Vignoble, 1820 Montreux',
    phone: '+41 21 555 12 34',
    email: 'hello@cave-tests.ch',
    stripeConnected: true,
    stripeAccountId: 'acct_test_secondary',
    userId: TEST_USERS.secondaryWineryOwner.id,
  },
};

/**
 * Pre-defined test experiences
 */
export const TEST_EXPERIENCES: Record<string, TestExperience> = {
  /** Standard bookable wine tasting */
  wineTasting: {
    id: 'test-exp-tasting',
    slug: 'wine-tasting-test',
    title: 'Premium Wine Tasting',
    description: 'Discover our finest selection of wines with expert guidance.',
    type: 'TASTING',
    price: 5000, // CHF 50
    minCapacity: 2,
    maxCapacity: 10,
    duration: 120,
    coverPhoto: '/images/test/wine-tasting.jpg',
    wineryId: TEST_WINERIES.activeWinery.id,
    availabilitySlots: [
      { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' }, // Monday
      { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }, // Tuesday
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' }, // Wednesday
      { dayOfWeek: 4, startTime: '10:00', endTime: '18:00' }, // Thursday
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' }, // Friday
    ],
  },

  /** Cellar visit experience */
  cellarVisit: {
    id: 'test-exp-cellar',
    slug: 'cellar-tour-test',
    title: 'Historic Cellar Tour',
    description:
      'Explore our centuries-old wine cellars and learn about wine-making.',
    type: 'CELLAR_VISIT',
    price: 7500, // CHF 75
    minCapacity: 4,
    maxCapacity: 15,
    duration: 90,
    coverPhoto: '/images/test/cellar-tour.jpg',
    wineryId: TEST_WINERIES.activeWinery.id,
    availabilitySlots: [
      { dayOfWeek: 3, startTime: '14:00', endTime: '17:00' }, // Wednesday
      { dayOfWeek: 6, startTime: '10:00', endTime: '16:00' }, // Saturday
    ],
  },

  /** Experience without Stripe (Coming Soon) */
  noStripeExperience: {
    id: 'test-exp-no-stripe',
    slug: 'experience-coming-soon',
    title: 'Upcoming Experience',
    description: 'This experience will be available soon.',
    type: 'WORKSHOP',
    price: 10000, // CHF 100
    minCapacity: 1,
    maxCapacity: 8,
    duration: 180,
    coverPhoto: '/images/test/workshop.jpg',
    wineryId: TEST_WINERIES.inactiveWinery.id,
    availabilitySlots: [
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' }, // Friday
    ],
  },

  /** Low capacity experience for testing capacity limits */
  lowCapacity: {
    id: 'test-exp-low-capacity',
    slug: 'exclusive-tasting-test',
    title: 'Exclusive Small Group Tasting',
    description: 'An intimate tasting experience for small groups.',
    type: 'TASTING',
    price: 15000, // CHF 150
    minCapacity: 2,
    maxCapacity: 4,
    duration: 150,
    coverPhoto: '/images/test/exclusive-tasting.jpg',
    wineryId: TEST_WINERIES.secondaryWinery.id,
    availabilitySlots: [
      { dayOfWeek: 4, startTime: '11:00', endTime: '15:00' }, // Thursday
      { dayOfWeek: 5, startTime: '11:00', endTime: '15:00' }, // Friday
    ],
  },
};

/**
 * Pre-defined test visitors
 */
export const TEST_VISITORS: Record<string, TestVisitor> = {
  /** Standard valid visitor */
  validVisitor: {
    name: 'Jean Test',
    email: 'jean.test@example.com',
    phone: '+41 79 123 45 67',
  },

  /** Swiss phone format */
  swissVisitor: {
    name: 'Marie Exemple',
    email: 'marie@example.ch',
    phone: '079 987 65 43',
  },

  /** International visitor */
  internationalVisitor: {
    name: 'John Smith',
    email: 'john.smith@test.com',
    phone: '+1 555 123 4567',
  },
};

// ============================================================
// FACTORY FUNCTIONS
// ============================================================

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate a booking reference (EC-XXXXXXXX format)
 */
export function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let reference = 'EC-';
  for (let i = 0; i < 8; i++) {
    reference += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return reference;
}

/**
 * Generate an access token
 */
export function generateAccessToken(): string {
  return `tok_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create a test booking with default values
 */
export function createTestBooking(
  overrides?: Partial<TestBooking>
): TestBooking {
  const experience = TEST_EXPERIENCES.wineTasting;
  const visitor = TEST_VISITORS.validVisitor;
  const guestCount = overrides?.guestCount ?? 2;

  return {
    id: generateTestId('booking'),
    reference: generateBookingReference(),
    accessToken: generateAccessToken(),
    status: 'CONFIRMED',
    experienceId: experience.id,
    date: getNextWeekday(7), // A week from now
    timeSlot: '10:00',
    guestCount,
    totalAmount: experience.price * guestCount,
    visitor,
    ...overrides,
  };
}

/**
 * Create a booking that is eligible for refund (>24 hours away)
 */
export function createRefundEligibleBooking(): TestBooking {
  return createTestBooking({
    date: getDaysFromNow(5), // 5 days from now
    timeSlot: '14:00',
    status: 'CONFIRMED',
  });
}

/**
 * Create a booking that is NOT eligible for refund (<24 hours away)
 */
export function createNoRefundBooking(): TestBooking {
  // Note: This may need special handling in tests since we can't
  // easily create a booking for today/tomorrow through normal flow
  return createTestBooking({
    date: getDaysFromNow(0), // Today
    timeSlot: '18:00', // Later today
    status: 'CONFIRMED',
  });
}

/**
 * Create a cancelled booking
 */
export function createCancelledBooking(): TestBooking {
  return createTestBooking({
    status: 'CANCELLED_BY_CLIENT',
  });
}

/**
 * Create a pending payment booking
 */
export function createPendingBooking(): TestBooking {
  return createTestBooking({
    status: 'PENDING_PAYMENT',
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get experience by slug
 */
export function getExperienceBySlug(slug: string): TestExperience | undefined {
  return Object.values(TEST_EXPERIENCES).find((exp) => exp.slug === slug);
}

/**
 * Get winery by ID
 */
export function getWineryById(id: string): TestWinery | undefined {
  return Object.values(TEST_WINERIES).find((winery) => winery.id === id);
}

/**
 * Get winery for an experience
 */
export function getWineryForExperience(
  experience: TestExperience
): TestWinery | undefined {
  return getWineryById(experience.wineryId);
}

/**
 * Format price from cents to display string (e.g., 5000 -> "CHF 50")
 */
export function formatPrice(cents: number): string {
  return `CHF ${(cents / 100).toFixed(0)}`;
}

/**
 * Calculate total price for a booking
 */
export function calculateTotalPrice(
  experience: TestExperience,
  guestCount: number
): number {
  return experience.price * guestCount;
}

/**
 * Check if experience is available on a given day
 */
export function isAvailableOnDay(
  experience: TestExperience,
  dayOfWeek: DayOfWeek
): boolean {
  return experience.availabilitySlots.some(
    (slot) => slot.dayOfWeek === dayOfWeek
  );
}
