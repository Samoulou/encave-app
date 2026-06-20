import Link from 'next/link';
import { Search } from 'lucide-react';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCHF } from '@/lib/utils/currency';
import { AdminSuspensionControls } from '@/components/features/admin/AdminSuspensionControls';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.admin',
    noIndex: true,
  });
}

interface AdminBookingsPageProps {
  searchParams: Promise<{ q?: string; status?: BookingStatus | 'ALL' }>;
}

export default async function AdminBookingsPage({
  searchParams,
}: AdminBookingsPageProps) {
  const filters = await searchParams;
  const q = filters.q?.trim() ?? '';
  const status =
    filters.status && filters.status !== 'ALL' ? filters.status : undefined;

  const bookings = await db.booking.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q, mode: 'insensitive' } },
              { visitorEmail: { contains: q, mode: 'insensitive' } },
              { visitorName: { contains: q, mode: 'insensitive' } },
              { experience: { title: { contains: q, mode: 'insensitive' } } },
              { winery: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      experience: { select: { title: true, slug: true } },
      winery: { select: { id: true, name: true } },
    },
  });

  const visitorEmails = Array.from(
    new Set(bookings.map((booking) => booking.visitorEmail))
  );
  const users = await db.user.findMany({
    where: { email: { in: visitorEmails } },
    select: { id: true, email: true, suspendedAt: true },
  });
  const usersByEmail = new Map(
    users.map((user) => [user.email.toLowerCase(), user])
  );

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-md text-burgundy-700">
          Admin bookings
        </h1>
        <p className="mt-2 text-muted-foreground">
          Search reservations by reference, guest, winery, or experience for
          support and incident handling.
        </p>
      </div>

      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle>Search filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Reference, guest, email, winery"
                className="pl-9"
              />
            </div>
            <select
              name="status"
              defaultValue={status ?? 'ALL'}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              {Object.values(BookingStatus).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-warm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Booking</th>
                  <th className="px-6 py-4">Guest</th>
                  <th className="px-6 py-4">Experience</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Money</th>
                  <th className="px-6 py-4">Support action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {bookings.map((booking) => {
                  const user = usersByEmail.get(
                    booking.visitorEmail.toLowerCase()
                  );
                  return (
                    <tr key={booking.id} className="align-top">
                      <td className="px-6 py-4">
                        <p className="font-mono font-medium text-foreground">
                          {booking.reference}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.date.toISOString().slice(0, 10)} ·{' '}
                          {booking.timeSlot}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">
                          {booking.visitorName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.visitorEmail}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">
                          {booking.experience.title}
                        </p>
                        <Link
                          href={`/admin/wineries/${booking.winery.id}`}
                          className="text-sm text-burgundy-700 hover:underline"
                        >
                          {booking.winery.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            booking.status === BookingStatus.CONFIRMED
                              ? 'success'
                              : booking.status.startsWith('CANCELLED')
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {booking.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <p>{formatCHF(booking.totalPrice)}</p>
                        <p>
                          Refunded:{' '}
                          {booking.refundAmount
                            ? formatCHF(booking.refundAmount)
                            : formatCHF(0)}
                        </p>
                      </td>
                      <td className="min-w-[280px] px-6 py-4">
                        {user ? (
                          <AdminSuspensionControls
                            targetId={user.id}
                            targetType="user"
                            mode={user.suspendedAt ? 'reinstate' : 'suspend'}
                            label={
                              user.suspendedAt
                                ? 'Reinstate guest account'
                                : 'Suspend guest account'
                            }
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Guest booking has no linked user account.
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
