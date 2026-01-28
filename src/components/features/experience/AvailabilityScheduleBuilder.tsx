'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Calendar, Copy, AlertTriangle, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TimeSlotPicker, type TimeSlot } from './TimeSlotPicker';
import { WeeklyCalendarPreview } from './WeeklyCalendarPreview';
import { DAYS_OF_WEEK_ORDERED, hasOverlappingSlots } from '@/lib/constants/time-slots';
import {
  getAvailabilitySlots,
  updateAvailabilitySlots,
  type AvailabilitySlotInput,
} from '@/server/actions/availability';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface AvailabilityScheduleBuilderProps {
  experienceId: string;
  experienceDuration: number;
  experienceStatus: string;
}

interface DaySlots {
  [dayOfWeek: number]: TimeSlot[];
}

export function AvailabilityScheduleBuilder({
  experienceId,
  experienceDuration,
  experienceStatus,
}: AvailabilityScheduleBuilderProps) {
  const t = useTranslations('experience.availability');
  const tCommon = useTranslations('common');
  const [slotsByDay, setSlotsByDay] = useState<DaySlots>({});
  const [selectedDay, setSelectedDay] = useState<number>(1); // Monday
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);

  // Load existing slots
  useEffect(() => {
    async function loadSlots() {
      setIsLoading(true);
      const result = await getAvailabilitySlots(experienceId);
      if (result.success) {
        const grouped: DaySlots = {};
        for (const slot of result.data) {
          const daySlots = grouped[slot.dayOfWeek] ?? [];
          daySlots.push({
            id: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isActive: slot.isActive,
          });
          grouped[slot.dayOfWeek] = daySlots;
        }
        setSlotsByDay(grouped);
      }
      setIsLoading(false);
    }
    loadSlots();
  }, [experienceId]);

  // Get all slots as flat array
  const getAllSlots = useCallback(() => {
    const all: Array<{ dayOfWeek: number } & TimeSlot> = [];
    for (const [day, slots] of Object.entries(slotsByDay)) {
      for (const slot of slots) {
        all.push({ dayOfWeek: parseInt(day), ...slot });
      }
    }
    return all;
  }, [slotsByDay]);

  // Check for overlaps on a specific day
  const getDayOverlapStatus = useCallback(
    (dayOfWeek: number) => {
      const daySlots = slotsByDay[dayOfWeek] ?? [];
      return hasOverlappingSlots(daySlots);
    },
    [slotsByDay]
  );

  // Handle slot changes for a day
  const handleSlotsChange = (dayOfWeek: number, slots: TimeSlot[]) => {
    setSlotsByDay((prev) => ({
      ...prev,
      [dayOfWeek]: slots,
    }));
    setHasChanges(true);
  };

  // Copy slots to all days
  const handleCopyToAllDays = () => {
    if (copyFromDay === null) return;

    const sourceSlots = slotsByDay[copyFromDay] ?? [];
    if (sourceSlots.length === 0) {
      toast.error(t('noSlotsToCopy'));
      return;
    }

    const newSlotsByDay: DaySlots = {};
    for (const day of DAYS_OF_WEEK_ORDERED) {
      // Create copies with new IDs
      newSlotsByDay[day.value] = sourceSlots.map((slot) => ({
        ...slot,
        id: `temp-${Date.now()}-${day.value}-${Math.random().toString(36).slice(2)}`,
      }));
    }

    setSlotsByDay(newSlotsByDay);
    setHasChanges(true);
    setCopyFromDay(null);
    toast.success(t('copiedSlots', { count: sourceSlots.length }));
  };

  // Save changes
  const handleSave = async () => {
    // Check for overlaps
    for (const day of DAYS_OF_WEEK_ORDERED) {
      if (getDayOverlapStatus(day.value)) {
        toast.error(t('fixOverlapsBeforeSaving', { day: day.label }));
        return;
      }
    }

    setIsSaving(true);

    const allSlots: AvailabilitySlotInput[] = getAllSlots().map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isActive: slot.isActive,
    }));

    const result = await updateAvailabilitySlots(experienceId, allSlots);

    if (result.success) {
      toast.success(t('savedSuccessfully'));
      setHasChanges(false);
      // Reload to get server-generated IDs
      const reloaded = await getAvailabilitySlots(experienceId);
      if (reloaded.success) {
        const grouped: DaySlots = {};
        for (const slot of reloaded.data) {
          const daySlots = grouped[slot.dayOfWeek] ?? [];
          daySlots.push({
            id: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isActive: slot.isActive,
          });
          grouped[slot.dayOfWeek] = daySlots;
        }
        setSlotsByDay(grouped);
      }
    } else {
      toast.error(result.error.message);
    }

    setIsSaving(false);
  };

  const allSlots = getAllSlots();
  const hasAnySlots = allSlots.length > 0;
  const hasActiveSlots = allSlots.some((s) => s.isActive);
  const isPublished = experienceStatus === 'PUBLISHED';
  const showPublishedWarning = isPublished && !hasActiveSlots;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-burgundy-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Published Warning */}
      {showPublishedWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">{t('noConfigured')}</p>
            <p className="text-sm text-amber-700 mt-1">
              {t('publishedNoSlots')}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasAnySlots && !showPublishedWarning && (
        <div className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-8 text-center">
          <Calendar className="h-12 w-12 text-stone-400 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-900 mb-2">{t('noConfigured')}</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {t('noConfiguredDescription')}
          </p>
        </div>
      )}

      {/* Day Selector */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-900">{t('selectDay')}</h3>
          {hasAnySlots && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setCopyFromDay(selectedDay)}
                >
                  <Copy className="h-4 w-4" />
                  {t('copyToAllDays')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('copyDialog.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('copyDialog.description', { day: DAYS_OF_WEEK_ORDERED.find((d) => d.value === selectedDay)?.label ?? '' })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tCommon('buttons.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCopyToAllDays}>
                    {t('copyToAllDays')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {DAYS_OF_WEEK_ORDERED.map((day) => {
            const daySlots = slotsByDay[day.value] ?? [];
            const hasSlots = daySlots.length > 0;
            const hasOverlap = getDayOverlapStatus(day.value);

            return (
              <button
                key={day.value}
                type="button"
                onClick={() => setSelectedDay(day.value)}
                className={cn(
                  'px-4 py-2 rounded-lg border text-sm font-medium transition-all relative',
                  selectedDay === day.value
                    ? 'border-burgundy-600 bg-burgundy-50 text-burgundy-700'
                    : hasOverlap
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : hasSlots
                    ? 'border-stone-300 bg-white text-slate-700 hover:border-burgundy-300'
                    : 'border-stone-200 bg-stone-50 text-slate-500 hover:border-stone-300'
                )}
              >
                {day.shortLabel}
                {hasSlots && (
                  <span
                    className={cn(
                      'absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                      hasOverlap
                        ? 'bg-red-500 text-white'
                        : 'bg-burgundy-600 text-white'
                    )}
                  >
                    {daySlots.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slot Picker for Selected Day */}
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <h4 className="font-medium text-slate-900 mb-4">
          {t('dayTimeSlots', { day: DAYS_OF_WEEK_ORDERED.find((d) => d.value === selectedDay)?.label ?? '' })}
        </h4>
        <TimeSlotPicker
          slots={slotsByDay[selectedDay] ?? []}
          experienceDuration={experienceDuration}
          onChange={(slots) => handleSlotsChange(selectedDay, slots)}
          hasOverlap={getDayOverlapStatus(selectedDay)}
        />
        {getDayOverlapStatus(selectedDay) && (
          <p className="mt-3 text-sm text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {t('slotsOverlap')}
          </p>
        )}
      </div>

      {/* Weekly Preview */}
      <div>
        <h3 className="font-medium text-slate-900 mb-4">{t('weeklyPreview')}</h3>
        <WeeklyCalendarPreview
          slots={allSlots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isActive: s.isActive,
          }))}
        />
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between border-t border-stone-200 pt-6">
        <div className="text-sm text-slate-500">
          {hasChanges && (
            <span className="flex items-center gap-2 text-amber-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              {tCommon('unsavedChanges')}
            </span>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {t('saveAvailability')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
