import { db } from '@/server/db';
import { AdminStats } from '@/components/features/admin/AdminStats';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

async function getWineryStats() {
  const [pending, verified, rejected, total] = await Promise.all([
    db.winery.count({ where: { status: 'PENDING' } }),
    db.winery.count({ where: { status: 'VERIFIED' } }),
    db.winery.count({ where: { status: 'REJECTED' } }),
    db.winery.count(),
  ]);

  return { pending, verified, rejected, total };
}

async function getRecentPending() {
  return db.winery.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      user: {
        select: { email: true },
      },
    },
  });
}

export default async function AdminDashboard() {
  const stats = await getWineryStats();
  const recentPending = await getRecentPending();

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-burgundy-700">Admin Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Manage winery verifications and platform settings
        </p>
      </div>

      <AdminStats {...stats} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Pending Wineries</CardTitle>
                <CardDescription>
                  Latest winery registrations awaiting review
                </CardDescription>
              </div>
              {stats.pending > 0 && (
                <Link href="/admin/wineries/pending">
                  <Button variant="outline" size="sm">
                    View all
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentPending.length === 0 ? (
              <p className="text-sm text-slate-500">
                No pending wineries to review.
              </p>
            ) : (
              <div className="space-y-4">
                {recentPending.map((winery) => (
                  <div
                    key={winery.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{winery.name}</p>
                      <p className="text-sm text-slate-500">
                        {winery.commune} &bull; {winery.user.email}
                      </p>
                      <p className="text-xs text-slate-400">
                        Registered{' '}
                        {new Date(winery.createdAt).toLocaleDateString('en-CH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <Link href={`/admin/wineries/${winery.id}`}>
                      <Button size="sm">Review</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/admin/wineries/pending" className="block">
              <Button variant="outline" className="w-full justify-start">
                Review pending wineries
                {stats.pending > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-burgundy-600 px-1.5 text-xs font-medium text-white">
                    {stats.pending}
                  </span>
                )}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
