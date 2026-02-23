'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns';
import { BookingStatus, ExperienceType } from '@prisma/client';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CalendarNavigation } from './CalendarNavigation';
import { ExperienceTypeDots } from './ExperienceTypeDot';
import { DayDetailPanel } from './DayDetailPanel';
import { BookingTooltip } from './BookingTooltip';

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

interface CalendarViewProps {
  calendarData: Map<string, CalendarDayData>;
  onDateChange: (_date: Date) => void;
  currentDate: Date;
  onBookingClick?: (_bookingId: string) => void;
  onRefresh?: () => void;
}

export function CalendarView({
  calendarData,
  onDateChange,
  currentDate,
  onBookingClick,
  onRefresh,
}: CalendarViewProps) {
  const t = useTranslations('calendar');
  const tDays = useTranslations('common.days.short');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekdays = [
    tDays('1'), // Mon
    tDays('2'), // Tue
    tDays('3'), // Wed
    tDays('4'), // Thu
    tDays('5'), // Fri
    tDays('6'), // Sat
    tDays('0'), // Sun
  ];

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getDayData = (date: Date): CalendarDayData | undefined => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return calendarData.get(dateKey);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const selectedDayData = selectedDate ? getDayData(selectedDate) : undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="p-4">
        {/* Navigation */}
        <div className="mb-4">
          <CalendarNavigation
            currentDate={currentDate}
            onDateChange={onDateChange}
            viewMode="calendar"
          />
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
          {/* Weekday Headers */}
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="bg-slate-50 py-2 text-center text-xs font-medium text-slate-500"
            >
              {day}
            </div>
          ))}

          {/* Days */}
          {calendarDays.map((date) => {
            const dayData = getDayData(date);
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isCurrentDay = isToday(date);
            const hasBookings = dayData && dayData.bookingCount > 0;
            const isBlocked = dayData && dayData.blockedExperienceIds.length > 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDayClick(date)}
                aria-label={format(date, 'PPPP')}
                className={cn(
                  'relative min-h-[80px] bg-white p-1.5 text-left transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none',
                  !isCurrentMonth && 'bg-slate-50 text-slate-400',
                  isBlocked && 'bg-red-50'
                )}
              >
                {/* Date Number */}
                <div
                  className={cn(
                    'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-sm',
                    isCurrentDay && 'bg-burgundy-600 font-semibold text-white',
                    !isCurrentDay && isCurrentMonth && 'font-medium text-slate-900',
                    !isCurrentMonth && 'text-slate-400'
                  )}
                >
                  {format(date, 'd')}
                </div>

                {/* Day Content */}
                {hasBookings && (
                  <div className="space-y-1">
                    {/* Booking Count */}
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-burgundy-100 px-1.5 py-0.5 text-xs font-medium text-burgundy-700">
                        {dayData.bookingCount}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                        <Users className="h-3 w-3" />
                        {dayData.totalGuests}
                      </span>
                    </div>

                    {/* Experience Type Dots */}
                    <ExperienceTypeDots
                      types={dayData.experienceTypes}
                      maxVisible={4}
                      size="sm"
                    />

                    {/* Preview of first booking */}
                    {dayData.bookings[0] && (
                      <BookingTooltip booking={dayData.bookings[0]}>
                        <div className="truncate text-[10px] text-slate-600">
                          {dayData.bookings[0].timeSlot} {dayData.bookings[0].visitorName}
                        </div>
                      </BookingTooltip>
                    )}
                  </div>
                )}

                {/* Blocked Indicator */}
                {isBlocked && !hasBookings && (
                  <div className="mt-1 text-[10px] text-red-600">Blocked</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-burgundy-600" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-burgundy-100" />
            <span>Booking count</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-red-50 ring-1 ring-red-200" />
            <span>Blocked</span>
          </div>
        </div>
      </Card>

      {/* Day Detail Panel */}
      {selectedDate && (
        <DayDetailPanel
          open={selectedDate !== null}
          onOpenChange={(open) => !open && setSelectedDate(null)}
          date={selectedDate}
          bookings={selectedDayData?.bookings || []}
          blockedExperienceIds={selectedDayData?.blockedExperienceIds || []}
          totalGuests={selectedDayData?.totalGuests || 0}
          onBookingClick={onBookingClick}
          onRefresh={onRefresh}
        />
      )}
    </TooltipProvider>
  );
}
