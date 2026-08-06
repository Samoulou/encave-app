import Link from 'next/link';
import { CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const legalPages = [
  { label: 'Terms', href: '/legal/terms' },
  { label: 'Privacy', href: '/legal/privacy' },
  { label: 'Cancellation', href: '/legal/cancellation' },
];

export default function AdminCompliancePage() {
  const postHogConfigured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const postHogHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com';

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-md text-burgundy-700">
          Public launch compliance
        </h1>
        <p className="mt-2 text-muted-foreground">
          Operational checklist for legal pages, nLPD data export, and analytics
          consent.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-warm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-burgundy-600" />
              Legal pages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {legalPages.map((page) => (
              <div
                key={page.href}
                className="flex items-center justify-between rounded-lg border border-stone-200 p-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-foreground">
                    {page.label}
                  </span>
                </div>
                <Link href={page.href}>
                  <Button variant="outline" size="sm">
                    Open
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-warm">
          <CardHeader>
            <CardTitle>Analytics consent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
              <span className="font-medium text-foreground">PostHog key</span>
              <Badge variant={postHogConfigured ? 'success' : 'warning'}>
                {postHogConfigured ? 'Configured' : 'Missing'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3">
              <span className="font-medium text-foreground">PostHog host</span>
              <span className="text-sm text-muted-foreground">
                {postHogHost}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              PostHog initializes only after the `encave_consent` cookie grants
              analytics consent and matches the current consent version.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-warm lg:col-span-2">
          <CardHeader>
            <CardTitle>nLPD data export</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Authenticated users can download their personal data as JSON from
              the privacy export endpoint.
            </p>
            <Link href="/api/privacy/export">
              <Button variant="outline">
                Test export endpoint
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
