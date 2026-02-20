import type { Metadata } from 'next';
import { ClientBookingsPage } from '@/components/features/client-dashboard/ClientBookingsPage';

export const metadata: Metadata = {
  title: 'My Bookings | EnCave',
  robots: { index: false, follow: false },
};

export default function MyBookingsPage() {
  return <ClientBookingsPage />;
}
