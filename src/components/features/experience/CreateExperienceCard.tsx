'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateExperienceCardProps {
  className?: string;
}

export function CreateExperienceCard({ className }: CreateExperienceCardProps) {
  return (
    <Link
      href="/dashboard/experiences/new"
      className={cn(
        'flex flex-col items-center justify-center p-8 rounded-xl',
        'border-2 border-dashed border-primary/30 hover:border-primary',
        'bg-[#f2e9eb]/40 hover:bg-[#f2e9eb]/80',
        'cursor-pointer transition-all group gap-4 min-h-[360px]',
        className
      )}
    >
      <div className="size-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
        <Plus className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold text-[#1a0f12] group-hover:text-primary transition-colors">
          Create New Experience
        </h3>
        <p className="text-sm text-gray-500 mt-1 max-w-[200px]">
          Offer a new tasting, tour or workshop.
        </p>
      </div>
    </Link>
  );
}
