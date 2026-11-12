'use client';

import dynamic from 'next/dynamic';

/**
 * Calendar loaded on demand (react-day-picker + date-fns locales ≈ 15 kB
 * gz). For calendars that only exist inside a popover / dropdown that is
 * CLOSED at first paint (home search panel, catalogue filters): a static
 * import shipped the picker in the initial JS of the two busiest public
 * pages for a control most visitors never open.
 *
 * Use the regular `@/components/ui/calendar` when the calendar is visible
 * immediately (booking date step).
 */
export const LazyCalendar = dynamic(
  () => import('@/components/ui/calendar').then((mod) => mod.Calendar),
  {
    ssr: false,
    // Same footprint as the picker so the popover does not jump.
    loading: () => (
      <div
        className="skeleton-warm h-[304px] w-[280px] animate-skeleton-shimmer rounded-md"
        aria-hidden="true"
      />
    ),
  }
);
