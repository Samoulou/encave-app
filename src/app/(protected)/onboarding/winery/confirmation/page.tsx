import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function WineryConfirmationPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get the user's winery
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

  // If already verified, redirect to dashboard
  if (winery.status === 'VERIFIED') {
    redirect('/dashboard');
  }

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-10">
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader className="space-y-1">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-burgundy-700">
            Registration Submitted!
          </CardTitle>
          <CardDescription className="text-base">
            Thank you for registering <strong>{winery.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-slate-50 p-4 text-left">
            <h3 className="mb-2 font-semibold text-slate-900">
              What happens next?
            </h3>
            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="font-medium text-burgundy-600">1.</span>
                Our team will review your winery registration
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-burgundy-600">2.</span>
                We may contact you for additional information
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-burgundy-600">3.</span>
                Once verified, you can start creating experiences
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
            <h3 className="mb-1 font-semibold text-amber-800">
              Expected Timeline
            </h3>
            <p className="text-sm text-amber-700">
              Verification typically takes 2-3 business days. You will receive
              an email notification once your winery is approved.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-500">
              Your winery status:{' '}
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                Pending Verification
              </span>
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
