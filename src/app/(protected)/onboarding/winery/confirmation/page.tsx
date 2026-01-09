import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, Mail, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-cream-50">
      {/* Progress bar - complete */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-stone-200/60">
        <div className="h-1.5 bg-stone-100">
          <div className="h-full bg-burgundy-600 rounded-r-full w-full" />
        </div>
      </div>

      <div className="mx-auto max-w-xl px-6 py-12 lg:py-16">
        {/* Success checkmark with glow */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-6 inline-flex">
            <div className="absolute inset-0 animate-pulse rounded-full bg-green-400/30 blur-xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-500 shadow-lg shadow-green-500/25">
              <CheckCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
            </div>
          </div>

          <h1 className="font-display text-display-md text-slate-900">
            Congratulations!
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Your winery <strong className="text-burgundy-700">{winery.name}</strong> has been submitted for verification.
          </p>
        </div>

        {/* Timeline */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-warm">
          <h2 className="mb-5 font-semibold text-slate-900">What happens next?</h2>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-burgundy-600 text-sm font-semibold text-white">
                1
              </div>
              <div className="pt-0.5">
                <p className="font-medium text-slate-900">Application received</p>
                <p className="text-sm text-slate-500">Your winery details are now in our system</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-burgundy-200 text-sm font-semibold text-burgundy-700">
                2
              </div>
              <div className="pt-0.5">
                <p className="font-medium text-slate-900">Review in progress</p>
                <p className="text-sm text-slate-500">Our team will verify your information</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-sm font-semibold text-slate-600">
                3
              </div>
              <div className="pt-0.5">
                <p className="font-medium text-slate-900">Notification of decision</p>
                <p className="text-sm text-slate-500">You&apos;ll be notified once your winery is approved</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Email confirmation callout */}
        <div className="mb-8 rounded-xl border-2 border-gold-300 bg-gradient-to-r from-gold-50 to-gold-100/50 p-5">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400">
              <Mail className="h-5 w-5 text-gold-950" />
            </div>
            <div>
              <p className="font-medium text-gold-900">Check your inbox</p>
              <p className="text-sm text-gold-800">
                We&apos;ve sent a confirmation email to <strong>{session.user.email}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Expected timeline */}
        <div className="mb-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Clock className="h-4 w-4" />
          <span>Expected response within <strong className="text-slate-700">48 hours</strong></span>
        </div>

        {/* Return button */}
        <Button asChild className="w-full">
          <Link href="/" className="inline-flex items-center justify-center gap-2">
            Return to homepage
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
