'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { updateConsent } from '@/server/actions/consent';
import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from '@/lib/constants/consent';
import type { ConsentPayload } from '@/lib/validators/consent';

function readConsent(): ConsentPayload | null {
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.split('=')[1];
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as ConsentPayload;
  } catch {
    return null;
  }
}

function writeConsent(payload: ConsentPayload): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(payload)
  )}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event('encave-consent-updated'));
}

export function CookieConsentBanner() {
  const t = useTranslations('legal.cookies');
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const consent = readConsent();
    setVisible(!consent || consent.version !== CONSENT_VERSION);
    setAnalytics(consent?.analytics ?? false);
  }, []);

  const save = (analyticsValue: boolean) => {
    const payload: ConsentPayload = {
      necessary: true,
      analytics: analyticsValue,
      version: CONSENT_VERSION,
      consentedAt: new Date().toISOString(),
    };
    writeConsent(payload);
    setVisible(false);
    startTransition(() => {
      void updateConsent(payload);
    });
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white p-4 shadow-2xl">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold text-foreground">
            {t('banner.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('banner.body')}
          </p>
          {customize ? (
            <div className="mt-4 grid gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold">
                  {t('category.necessary.title')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('category.necessary.description')}
                </p>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label
                    htmlFor="analytics-consent"
                    className="text-sm font-semibold"
                  >
                    {t('category.analytics.title')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('category.analytics.description')}
                  </p>
                </div>
                <Switch
                  id="analytics-consent"
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row md:flex-shrink-0">
          {customize ? (
            <Button onClick={() => save(analytics)}>{t('modal.save')}</Button>
          ) : (
            <Button variant="outline" onClick={() => setCustomize(true)}>
              {t('banner.customize')}
            </Button>
          )}
          <Button variant="outline" onClick={() => save(false)}>
            {t('banner.rejectAll')}
          </Button>
          <Button onClick={() => save(true)}>{t('banner.acceptAll')}</Button>
        </div>
      </div>
    </div>
  );
}
