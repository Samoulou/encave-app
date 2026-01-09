'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowUpDown, Eye, MapPin, Wine } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PendingWinery {
  id: string;
  name: string;
  commune: string;
  createdAt: Date;
  user: {
    email: string;
  };
}

interface PendingWineriesTableProps {
  wineries: PendingWinery[];
  communes: string[];
}

export function PendingWineriesTable({
  wineries,
  communes,
}: PendingWineriesTableProps) {
  const [communeFilter, setCommuneFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredWineries = wineries
    .filter((w) => communeFilter === 'all' || w.commune === communeFilter)
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  return (
    <Card className="shadow-warm">
      <CardHeader className="border-b border-stone-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Showing <span className="font-semibold text-burgundy-700">{filteredWineries.length}</span> pending winer{filteredWineries.length === 1 ? 'y' : 'ies'}
          </p>
          <div className="flex items-center gap-3">
            <Select value={communeFilter} onValueChange={setCommuneFilter}>
              <SelectTrigger className="w-[180px] border-stone-200 bg-white shadow-sm hover:border-burgundy-300 focus:border-burgundy-400 focus:ring-burgundy-400/20">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-burgundy-500" />
                  <SelectValue placeholder="Filter by commune" />
                </div>
              </SelectTrigger>
              <SelectContent className="border-stone-200 bg-white shadow-lg">
                <SelectItem value="all" className="focus:bg-burgundy-50 focus:text-burgundy-900">All communes</SelectItem>
                {communes.map((commune) => (
                  <SelectItem key={commune} value={commune} className="focus:bg-burgundy-50 focus:text-burgundy-900">
                    {commune}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="hover:border-burgundy-300 hover:bg-burgundy-50"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredWineries.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Wine className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-medium text-slate-900">All caught up!</p>
            <p className="mt-1 text-sm text-slate-500">
              No pending wineries to review.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Winery Name</th>
                  <th className="px-6 py-4">Commune</th>
                  <th className="px-6 py-4">Applicant</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredWineries.map((winery) => (
                  <tr key={winery.id} className="transition-colors hover:bg-burgundy-50/40">
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">{winery.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {winery.commune}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{winery.user.email}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">
                        {formatDistanceToNow(new Date(winery.createdAt), { addSuffix: true })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/wineries/${winery.id}`}>
                        <Button size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
