import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard | EnCave',
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  redirect('/dashboard/bookings');
}
