'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { BookingStatus, ExperienceType } from '@prisma/client';
import { ViewToggle, CalendarView, WeekView } from '@/components/features/booking/calendar';

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

  const handleDateChange = useCallback(
    (date: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('month', format(date, 'yyyy-MM'));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

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
