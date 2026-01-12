import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarX, Sparkles } from 'lucide-react';

export function BookingsEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <CalendarX className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="font-display text-xl font-semibold text-slate-900">
          No bookings yet
        </h3>
        <p className="mt-2 max-w-sm text-slate-600">
          Share your experiences to attract visitors and start receiving bookings.
        </p>
        <Button asChild className="mt-6 gap-2">
          <Link href="/dashboard/experiences">
            <Sparkles className="h-4 w-4" />
            Manage Experiences
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
