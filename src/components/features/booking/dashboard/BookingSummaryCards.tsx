import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, CalendarRange, CalendarClock, Users } from 'lucide-react';
import type { BookingSummary } from '@/server/queries/booking.queries';

interface BookingSummaryCardsProps {
  summary: BookingSummary;
}

export function BookingSummaryCards({ summary }: BookingSummaryCardsProps) {
  const cards = [
    {
      title: "Today's Bookings",
      count: summary.todayCount,
      guests: summary.todayGuests,
      icon: CalendarDays,
      iconColor: 'text-burgundy-600',
      bgColor: 'bg-burgundy-50',
    },
    {
      title: 'This Week',
      count: summary.weekCount,
      guests: summary.weekGuests,
      icon: CalendarRange,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'This Month',
      count: summary.monthCount,
      guests: summary.monthGuests,
      icon: CalendarClock,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Guests',
      count: summary.totalGuests,
      guests: null,
      icon: Users,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bgColor}`}
                >
                  <Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-600">{card.title}</p>
                  <p className="text-2xl font-semibold text-slate-900">{card.count}</p>
                  {card.guests !== null && (
                    <p className="text-xs text-slate-500">
                      {card.guests} guest{card.guests !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
