import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AdminStatsProps {
  pending: number;
  verified: number;
  rejected: number;
  total: number;
}

interface StatCardProps {
  value: number;
  label: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

function StatCard({
  value,
  label,
  borderColor,
  bgColor,
  textColor,
}: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', bgColor)}>
      <div
        className={cn('absolute bottom-0 left-0 top-0 w-1.5', borderColor)}
      />
      <CardContent className="p-6">
        <p className={cn('text-4xl font-bold', textColor)}>{value}</p>
        <p className="mt-1 text-sm text-slate-600">{label}</p>
      </CardContent>
    </Card>
  );
}

export function AdminStats({
  pending,
  verified,
  rejected,
  total,
}: AdminStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        value={pending}
        label="Pending Review"
        borderColor="bg-amber-500"
        bgColor="bg-amber-50/50"
        textColor="text-amber-700"
      />
      <StatCard
        value={verified}
        label="Verified"
        borderColor="bg-green-500"
        bgColor="bg-green-50/50"
        textColor="text-green-700"
      />
      <StatCard
        value={rejected}
        label="Rejected"
        borderColor="bg-red-500"
        bgColor="bg-red-50/50"
        textColor="text-red-700"
      />
      <StatCard
        value={total}
        label="Total Wineries"
        borderColor="bg-slate-400"
        bgColor="bg-slate-50/50"
        textColor="text-slate-700"
      />
    </div>
  );
}
