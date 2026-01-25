'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { BookingStatus, ExperienceType } from '@prisma/client';
import { ViewToggle } from '@/components/features/booking/calendar/ViewToggle';
import { CalendarView } from '@/components/features/booking/calendar/CalendarView';
import { WeekView } from '@/components/features/booking/calendar/WeekView';

const POLLING_INTERVAL = 60_000; // 60 seconds

interface CalendarBooking {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  status: BookingStatus;
  experience: {
    id: string;
    title: string;
    slug: string;
    type: ExperienceType;
    duration: number;
  };
}

interface CalendarDayData {
  date: string;
  bookings: CalendarBooking[];
  bookingCount: number;
  totalGuests: number;
  experienceTypes: ExperienceType[];
  blockedExperienceIds: string[];
}

interface CalendarViewWrapperProps {
  viewToggleOnly?: boolean;
  viewMode?: 'calendar' | 'week';
  calendarData?: Map<string, CalendarDayData>;
  initialDate?: Date;
}

export function CalendarViewWrapper({
  viewToggleOnly,
  viewMode,
  calendarData,
  initialDate,
}: CalendarViewWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastRefreshRef = useRef<number>(Date.now());

  const handleDateChange = useCallback(
    (date: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('month', format(date, 'yyyy-MM'));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleRefresh = useCallback(() => {
    lastRefreshRef.current = Date.now();
    router.refresh();
  }, [router]);

  // Auto-refresh when tab becomes visible
  useEffect(() => {
    if (viewToggleOnly) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only refresh if it's been more than 5 seconds since last refresh
        const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
        if (timeSinceLastRefresh > 5000) {
          handleRefresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [viewToggleOnly, handleRefresh]);

  // Optional polling for real-time updates (every 60 seconds)
  useEffect(() => {
    if (viewToggleOnly) return;

    const intervalId = setInterval(() => {
      // Only poll if tab is visible
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [viewToggleOnly, handleRefresh]);

  // Just render the toggle button
  if (viewToggleOnly) {
    return <ViewToggle />;
  }

  // Render the appropriate calendar view
  if (!calendarData || !initialDate) {
    return null;
  }

  if (viewMode === 'calendar') {
    return (
      <CalendarView
        calendarData={calendarData}
        currentDate={initialDate}
        onDateChange={handleDateChange}
        onRefresh={handleRefresh}
      />
    );
  }

  if (viewMode === 'week') {
    return (
      <WeekView
        calendarData={calendarData}
        currentDate={initialDate}
        onDateChange={handleDateChange}
        onRefresh={handleRefresh}
      />
    );
  }

  return null;
}
