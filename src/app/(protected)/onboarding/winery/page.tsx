import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { WineryOnboardingForm } from '@/components/features/winery/WineryOnboardingForm';

export default async function WineryOnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user already has a winery
  const existingWinery = await db.winery.findUnique({
    where: { userId: session.user.id },
  });

  if (existingWinery) {
    // Redirect based on winery status
    if (existingWinery.status === 'PENDING') {
      redirect('/onboarding/winery/confirmation');
    } else if (existingWinery.status === 'VERIFIED') {
      redirect('/dashboard');
    }
  }

  return (
    <div className="container py-10">
      <WineryOnboardingForm />
    </div>
  );
}
