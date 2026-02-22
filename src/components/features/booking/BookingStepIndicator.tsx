'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface BookingStepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

export function BookingStepIndicator({
  currentStep,
  totalSteps = 3,
}: BookingStepIndicatorProps) {
  const t = useTranslations('booking');

  const steps = [
    { label: t('step.date') },
    { label: t('step.session') },
    { label: t('step.guests') },
  ];

  return (
    <div className="flex items-center justify-center gap-0 py-3">
      {steps.slice(0, totalSteps).map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        const isPending = stepNumber > currentStep;

        return (
          <div key={index} className="flex items-center">
            {/* Dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-3 w-3 rounded-full transition-all duration-300',
                  isCompleted && 'bg-primary',
                  isActive && 'bg-primary ring-2 ring-primary/30 ring-offset-2',
                  isPending && 'bg-stone-200'
                )}
              />
              <span
                className={cn(
                  'mt-1.5 text-[10px] font-medium transition-colors',
                  isCompleted && 'text-primary',
                  isActive && 'text-primary',
                  isPending && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {index < totalSteps - 1 && (
              <div
                className={cn(
                  'h-0.5 w-8 mx-1 -mt-4 transition-colors duration-300',
                  stepNumber < currentStep ? 'bg-primary' : 'bg-stone-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
