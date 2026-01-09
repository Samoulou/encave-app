'use client';

import { useQueryState } from 'nuqs';
import { MapPin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CommuneFilterProps {
  communes: string[];
}

export function CommuneFilter({ communes }: CommuneFilterProps) {
  const [commune, setCommune] = useQueryState('commune', {
    shallow: false,
  });

  return (
    <Select
      value={commune ?? 'all'}
      onValueChange={(value) => setCommune(value === 'all' ? null : value)}
    >
      <SelectTrigger className="w-[200px] border-stone-200 bg-white shadow-sm hover:border-burgundy-300 focus:border-burgundy-400 focus:ring-burgundy-400/20">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-burgundy-500" />
          <SelectValue placeholder="All communes" />
        </div>
      </SelectTrigger>
      <SelectContent className="border-stone-200 bg-white shadow-lg">
        <SelectItem value="all" className="focus:bg-burgundy-50 focus:text-burgundy-900">
          All communes
        </SelectItem>
        {communes.map((c) => (
          <SelectItem key={c} value={c} className="focus:bg-burgundy-50 focus:text-burgundy-900">
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
