'use client';

import { useQueryState } from 'nuqs';
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
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="All communes" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All communes</SelectItem>
        {communes.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
