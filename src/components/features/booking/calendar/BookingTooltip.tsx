'use client';

import { ExperienceType } from '@prisma/client';
import { Clock, Users } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ExperienceTypeDot } from './ExperienceTypeDot';
import { EXPERIENCE_TYPE_LABELS } from '@/lib/constants/experience-type-colors';

interface BookingTooltipProps {
  children: React.ReactNode;
  booking: {
    visitorName: string;
    timeSlot: string;
    guestCount: number;
    experience: {
      title: string;
      type: ExperienceType;
      duration: number;
    };
  };
}

export function BookingTooltip({ children, booking }: BookingTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs bg-white p-3 text-slate-900 shadow-lg border">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ExperienceTypeDot type={booking.experience.type} size="md" />
            <span className="font-medium">{booking.experience.title}</span>
          </div>
          <div className="text-sm text-slate-600">
            <span className="font-medium">{booking.visitorName}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{booking.timeSlot}</span>
              <span className="text-slate-400">({booking.experience.duration}min)</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{booking.guestCount} guests</span>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            {EXPERIENCE_TYPE_LABELS[booking.experience.type]}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
