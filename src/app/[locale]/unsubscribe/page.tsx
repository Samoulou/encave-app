import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
  }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status;
  const type = params.type;

  const typeLabels: Record<string, string> = {
    daily_digest: 'Daily Digest',
    weekly_summary: 'Weekly Summary',
    marketing: 'Marketing emails',
    all: 'all marketing emails',
  };

  if (status === 'success') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-slate-900">
            Unsubscribed Successfully
          </h1>
          <p className="mb-6 text-slate-600">
            You have been unsubscribed from{' '}
            {type ? typeLabels[type] || type : 'email notifications'}.
          </p>
          <p className="mb-8 text-sm text-slate-500">
            You can manage your notification preferences anytime from your
            dashboard settings.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/dashboard/settings/notifications">
                Manage Preferences
              </Link>
            </Button>
            <Button asChild>
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-amber-100 p-3">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-slate-900">
            Invalid Link
          </h1>
          <p className="mb-8 text-slate-600">
            This unsubscribe link is invalid or has expired. Please use the link
            from a recent email or manage your preferences from your dashboard.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/login">Login to Manage</Link>
            </Button>
            <Button asChild>
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-red-100 p-3">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-slate-900">
            Something Went Wrong
          </h1>
          <p className="mb-8 text-slate-600">
            We couldn&apos;t process your unsubscribe request. Please try again
            or contact support if the problem persists.
          </p>
          <Button asChild>
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Default: no status, show info page
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 font-display text-2xl font-bold text-slate-900">
          Email Preferences
        </h1>
        <p className="mb-8 text-slate-600">
          To manage your email preferences, please log in to your account and
          visit the notification settings.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
