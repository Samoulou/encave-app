'use client';

import { useState, useMemo, Fragment } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
} from 'date-fns';
import { fr, de, enUS } from 'date-fns/locale';
import { BookingStatus, ExperienceType } from '@prisma/client';
import { Users } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CalendarNavigation } from './CalendarNavigation';
import { DayDetailPanel } from './DayDetailPanel';
import { BookingTooltip } from './BookingTooltip';
import { EXPERIENCE_TYPE_COLORS } from '@/lib/constants/experience-type-colors';

const localeMap = { fr, de, en: enUS };

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

interface WeekViewProps {
  calendarData: Map<string, CalendarDayData>;
  onDateChange: (_date: Date) => void;
  currentDate: Date;
  onBookingClick?: (_bookingId: string) => void;
  onRefresh?: () => void;
}

// Time slots from 8:00 to 20:00
const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => {
  const hour = 8 + i;
  return `${hour.toString().padStart(2, '0')}:00`;
});

export function WeekView({
  calendarData,
  onDateChange,
  currentDate,
  onBookingClick,
  onRefresh,
}: WeekViewProps) {
  const t = useTranslations('calendar');
  const tExp = useTranslations('experience.types');
  const locale = useLocale();
  const dateLocale = localeMap[locale as keyof typeof localeMap] || enUS;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const getDayData = (date: Date): CalendarDayData | undefined => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return calendarData.get(dateKey);
  };

  const getBookingsForTimeSlot = (date: Date, timeSlot: string) => {
    const dayData = getDayData(date);
    if (!dayData) return [];

    const slotHourStr = timeSlot.split(':')[0] || '0';
    const slotHour = parseInt(slotHourStr, 10);
    return dayData.bookings.filter((booking) => {
      const bookingHourStr = booking.timeSlot.split(':')[0] || '0';
      const bookingHour = parseInt(bookingHourStr, 10);
      return bookingHour === slotHour;
    });
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
            viewMode="week"
          />
        </div>

        {/* Week Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header with day names */}
            <div className="grid grid-cols-8 gap-px border-b border-border bg-border">
              <div className="bg-muted p-2" /> {/* Time column header */}
              {weekDays.map((date) => {
                const dayData = getDayData(date);
                const isCurrentDay = isToday(date);
                const isBlocked =
                  dayData && dayData.blockedExperienceIds.length > 0;

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDayClick(date)}
                    aria-label={format(date, 'PPPP', { locale: dateLocale })}
                    className={cn(
                      'bg-white p-2 text-center transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      isCurrentDay && 'bg-burgundy-50',
                      isBlocked && 'bg-red-50'
                    )}
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      {format(date, 'EEE', { locale: dateLocale })}
                    </div>
                    <div
                      className={cn(
                        'mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                        isCurrentDay && 'bg-burgundy-600 text-white',
                        !isCurrentDay && 'text-foreground'
                      )}
                    >
                      {format(date, 'd')}
                    </div>
                    {dayData && dayData.bookingCount > 0 && (
                      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                        <span className="font-medium text-burgundy-600">
                          {dayData.bookingCount}
                        </span>
                        <Users className="h-3 w-3" />
                        <span>{dayData.totalGuests}</span>
                      </div>
                    )}
                    {isBlocked && (
                      <div className="mt-1 text-[10px] text-red-500">
                        {t('blocked')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Time slots grid */}
            <div className="grid grid-cols-8 gap-px bg-border">
              {TIME_SLOTS.map((timeSlot) => (
                <Fragment key={timeSlot}>
                  {/* Time label */}
                  <div className="bg-muted p-2 text-right text-xs text-muted-foreground">
                    {timeSlot}
                  </div>

                  {/* Day cells */}
                  {weekDays.map((date) => {
                    const bookings = getBookingsForTimeSlot(date, timeSlot);
                    const hasBookings = bookings.length > 0;

                    return (
                      <div
                        key={`${date.toISOString()}-${timeSlot}`}
                        className={cn(
                          'min-h-[48px] bg-white p-1',
                          hasBookings && 'bg-muted'
                        )}
                      >
                        {bookings.map((booking) => (
                          <BookingTooltip key={booking.id} booking={booking}>
                            <button
                              onClick={() => onBookingClick?.(booking.id)}
                              aria-label={`${booking.visitorName}, ${booking.timeSlot}, ${booking.guestCount} ${booking.guestCount === 1 ? 'guest' : 'guests'}`}
                              className="mb-1 w-full rounded px-1.5 py-1 text-left text-xs text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                              style={{
                                backgroundColor:
                                  EXPERIENCE_TYPE_COLORS[
                                    booking.experience.type
                                  ],
                              }}
                            >
                              <div className="truncate font-medium">
                                {booking.visitorName}
                              </div>
                              <div className="flex items-center gap-1 opacity-90">
                                <span>{booking.timeSlot}</span>
                                <span>·</span>
                                <span>{booking.guestCount}g</span>
                              </div>
                            </button>
                          </BookingTooltip>
                        ))}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium">{t('experienceTypes')}</span>
          {Object.entries(EXPERIENCE_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ backgroundColor: color }}
              />
              <span>{tExp(type)}</span>
            </div>
          ))}
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
