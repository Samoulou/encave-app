'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TIME_SLOTS, calculateEndTime } from '@/lib/constants/time-slots';
import { cn } from '@/lib/utils';

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  experienceDuration: number;
  onChange: (_slots: TimeSlot[]) => void;
  hasOverlap?: boolean;
}

export function TimeSlotPicker({
  slots,
  experienceDuration,
  onChange,
  hasOverlap = false,
}: TimeSlotPickerProps) {
  const t = useTranslations('experience.timeSlots');

  const handleAddSlot = () => {
    // Find first available time
    const usedStartTimes = new Set(slots.map((s) => s.startTime));
    let defaultStart = '09:00';
    for (const time of TIME_SLOTS) {
      if (!usedStartTimes.has(time)) {
        defaultStart = time;
        break;
      }
    }

    const newSlot: TimeSlot = {
      id: `temp-${Date.now()}`,
      startTime: defaultStart,
      endTime: calculateEndTime(defaultStart, experienceDuration),
      isActive: true,
    };
    onChange([...slots, newSlot]);
  };

  const handleRemoveSlot = (slotId: string) => {
    onChange(slots.filter((s) => s.id !== slotId));
  };

  const handleUpdateSlot = (slotId: string, updates: Partial<TimeSlot>) => {
    onChange(
      slots.map((s) => {
        if (s.id !== slotId) return s;

        const updated = { ...s, ...updates };

        // Auto-calculate end time if start time changed
        if (updates.startTime && !updates.endTime) {
          updated.endTime = calculateEndTime(
            updates.startTime,
            experienceDuration
          );
        }

        return updated;
      })
    );
  };

  const handleToggleActive = (slotId: string, isActive: boolean) => {
    handleUpdateSlot(slotId, { isActive });
  };

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-sm text-slate-500">{t('noConfigured')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddSlot}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('addSlot')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {slots.map((slot, index) => (
        <div
          key={slot.id}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3 transition-colors',
            !slot.isActive && 'bg-stone-50 opacity-60',
            hasOverlap && 'border-red-300 bg-red-50'
          )}
        >
          {/* Active Toggle */}
          <Switch
            checked={slot.isActive}
            onCheckedChange={(checked) => handleToggleActive(slot.id, checked)}
            aria-label={t('toggleActive', { index: index + 1 })}
          />

          {/* Start Time */}
          <Select
            value={slot.startTime}
            onValueChange={(value) =>
              handleUpdateSlot(slot.id, { startTime: value })
            }
          >
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue placeholder={t('startPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-slate-400">{t('to')}</span>

          {/* End Time */}
          <Select
            value={slot.endTime}
            onValueChange={(value) =>
              handleUpdateSlot(slot.id, { endTime: value })
            }
          >
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue placeholder={t('endPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.filter((time) => time > slot.startTime).map(
                (time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                )
              )}
              {/* Allow times past 20:00 for end time */}
              <SelectItem value="20:30">20:30</SelectItem>
              <SelectItem value="21:00">21:00</SelectItem>
              <SelectItem value="21:30">21:30</SelectItem>
              <SelectItem value="22:00">22:00</SelectItem>
            </SelectContent>
          </Select>

          {/* Remove Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemoveSlot(slot.id)}
            className="h-9 w-9 text-slate-400 hover:text-red-600"
            aria-label={t('removeSlot', { index: index + 1 })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add Slot Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddSlot}
        className="mt-2 gap-2"
      >
        <Plus className="h-4 w-4" />
        {t('addAnotherSlot')}
      </Button>
    </div>
  );
}
