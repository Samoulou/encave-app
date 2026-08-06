'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/shared/Skeleton';
import { cn } from '@/lib/utils';
import type { MapWinery } from './types';

const InteractiveMap = dynamic(
  () =>
    import('./InteractiveMap').then((mod) => ({
      default: mod.InteractiveMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-stone-100">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>
    ),
  }
);

interface DynamicMapProps {
  wineries: MapWinery[];
  onWineryClick?: (_slug: string) => void;
  className?: string;
  singleWinery?: boolean;
}

export function DynamicMap({
  wineries,
  onWineryClick,
  className,
  singleWinery,
}: DynamicMapProps) {
  return (
    <InteractiveMap
      wineries={wineries}
      onWineryClick={onWineryClick}
      className={cn('h-full w-full', className)}
      singleWinery={singleWinery}
    />
  );
}
