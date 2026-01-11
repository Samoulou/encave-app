'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Clock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { startStripeOnboarding } from '@/server/actions/stripe';
import { toast } from 'sonner';

interface StripeCallbackResultProps {
  status: 'complete' | 'pending' | 'incomplete';
  isRefresh: boolean;
  wineryId: string;
}

export function StripeCallbackResult({
  status,
  isRefresh,
  wineryId,
}: StripeCallbackResultProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleContinueOnboarding = async () => {
    setIsLoading(true);
    try {
      const result = await startStripeOnboarding(wineryId);
      if (result.success) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error('Failed to continue setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'complete') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" />
          </div>
          <CardTitle className="font-display text-2xl text-green-800">
            Payment Setup Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6 text-green-700">
            Your payment account is ready. You can now publish experiences and
            receive payments from visitors.
          </p>
          <Button asChild>
            <Link href="/dashboard/experiences">
              Go to Experiences
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === 'pending') {
    return (
      <Card className="border-gold-200 bg-gold-50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-100">
            <Clock className="h-8 w-8 text-gold-600" aria-hidden="true" />
          </div>
          <CardTitle className="font-display text-2xl text-gold-800">
            Verification Pending
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6 text-gold-700">
            Your details have been submitted and are being verified by Stripe.
            This usually takes 1-2 business days. We will notify you once
            verified.
          </p>
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              Return to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Incomplete - needs to continue onboarding
  return (
    <Card className="border-burgundy-200 bg-burgundy-50">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-burgundy-100">
          <AlertCircle className="h-8 w-8 text-burgundy-600" aria-hidden="true" />
        </div>
        <CardTitle className="font-display text-2xl text-burgundy-800">
          {isRefresh ? 'Session Expired' : 'Setup Incomplete'}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="mb-6 text-burgundy-700">
          {isRefresh
            ? 'Your onboarding session has expired. Please continue where you left off.'
            : 'Your payment setup is not complete. Please continue to finish the process.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={handleContinueOnboarding} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading...
              </>
            ) : (
              <>
                Continue Setup
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
