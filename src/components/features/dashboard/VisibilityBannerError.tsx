'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Error variant of the visibility banner (ENC-027).
 *
 * Rendered when the parent Server Component fails to load the winery
 * (DB unreachable, transient issue). Provides a retry CTA that calls
 * `router.refresh()` inside a transition so the user gets visual feedback.
 *
 * Stays a tiny client component on purpose — the parent is server, and
 * Next.js does not yet allow a refresh button from a server boundary.
 */
interface VisibilityBannerErrorProps {
  title: string;
  subtitle: string;
  retryLabel: string;
}

export function VisibilityBannerError({
  title,
  subtitle,
  retryLabel,
}: VisibilityBannerErrorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRetry = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <section
      role="alert"
      aria-labelledby="visibility-banner-error-title"
      className="rounded-xl border border-red-200 bg-red-50/40 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h2
            id="visibility-banner-error-title"
            className="font-display text-lg font-semibold text-red-900 sm:text-xl"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-red-800">{subtitle}</p>

          <div className="mt-5">
            <Button
              type="button"
              variant="secondary"
              onClick={handleRetry}
              disabled={isPending}
              className="min-h-[44px] w-full sm:w-auto"
            >
              {retryLabel}
              <RotateCcw
                className={`ml-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
