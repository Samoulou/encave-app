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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpDown, Eye } from 'lucide-react';

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
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Pending Wineries ({filteredWineries.length})</CardTitle>
          <div className="flex items-center gap-4">
            <Select value={communeFilter} onValueChange={setCommuneFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by commune" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All communes</SelectItem>
                {communes.map((commune) => (
                  <SelectItem key={commune} value={commune}>
                    {commune}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Date {sortOrder === 'desc' ? '(Newest)' : '(Oldest)'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredWineries.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            No pending wineries to review.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm font-medium text-slate-500">
                  <th className="pb-3 pr-4">Winery Name</th>
                  <th className="pb-3 pr-4">Commune</th>
                  <th className="pb-3 pr-4">Applicant Email</th>
                  <th className="pb-3 pr-4">Registration Date</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWineries.map((winery) => (
                  <tr key={winery.id} className="border-b last:border-0">
                    <td className="py-4 pr-4 font-medium">{winery.name}</td>
                    <td className="py-4 pr-4 text-slate-600">{winery.commune}</td>
                    <td className="py-4 pr-4 text-slate-600">{winery.user.email}</td>
                    <td className="py-4 pr-4 text-slate-600">
                      {new Date(winery.createdAt).toLocaleDateString('en-CH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-4 text-right">
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
