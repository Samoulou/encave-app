import { Calendar, Clock } from 'lucide-react';

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface AvailabilityDisplayProps {
  slots: AvailabilitySlot[];
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours || '0', 10);
  const m = minutes || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function AvailabilityDisplay({ slots }: AvailabilityDisplayProps) {
  if (!slots || slots.length === 0) {
    return null;
  }

  // Group slots by day
  const slotsByDay = slots.reduce(
    (acc, slot) => {
      if (!acc[slot.dayOfWeek]) {
        acc[slot.dayOfWeek] = [];
      }
      acc[slot.dayOfWeek]!.push(slot);
      return acc;
    },
    {} as Record<number, AvailabilitySlot[]>
  );

  // Get available days sorted
  const availableDays = Object.keys(slotsByDay)
    .map(Number)
    .sort((a, b) => {
      // Sort Monday first (1), then through Sunday (0)
      const orderA = a === 0 ? 7 : a;
      const orderB = b === 0 ? 7 : b;
      return orderA - orderB;
    });

  return (
    <section className="mt-8">
      <h3 className="text-2xl font-bold mb-4 text-[#1a0f12] flex items-center gap-2">
        <Calendar className="h-6 w-6 text-primary" />
        Availability
      </h3>
      <div className="bg-slate-50 rounded-xl p-4 border border-stone-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableDays.map((day) => (
            <div
              key={day}
              className="flex items-center justify-between bg-white rounded-lg p-3 border border-stone-100"
            >
              <span className="font-medium text-slate-700">{DAYS_OF_WEEK[day]}</span>
              <div className="flex flex-wrap gap-2 justify-end">
                {slotsByDay[day]?.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 text-sm text-slate-600 bg-primary/10 px-2 py-1 rounded"
                  >
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {availableDays.length === 0 && (
          <p className="text-slate-500 text-center py-4">
            No availability set. Contact the winery for more information.
          </p>
        )}
      </div>
    </section>
  );
}
