import { NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { db } from '@/server/db';
import { hashToken } from '@/lib/utils/token';
import { InvitationAcceptForm } from '@/components/features/auth/InvitationAcceptForm';
import { Wine } from 'lucide-react';
import type { Locale } from '@/i18n/routing';

interface InvitationPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: InvitationPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'invitation' });
  return { title: `${t('title')} | EnCave`, robots: { index: false } };
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'invitation' });

  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      email: true,
      wineryName: true,
      acceptedAt: true,
      expiresAt: true,
    },
  });

  const isValid =
    invitation &&
    !invitation.acceptedAt &&
    invitation.expiresAt.getTime() >= Date.now();

  const messages = await getMessages();
  const scopedMessages = {
    invitation: (messages as Record<string, unknown>).invitation,
    common: (messages as Record<string, unknown>).common,
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-warm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
            <Wine className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="font-display text-xl font-bold">EnCave</span>
        </div>

        {!isValid ? (
          <div className="space-y-3">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('invalidTitle')}
            </h1>
            <p className="text-muted-foreground">{t('invalidDescription')}</p>
          </div>
        ) : (
          <NextIntlClientProvider
            locale={locale as Locale}
            messages={scopedMessages}
          >
            <div className="mb-6 space-y-2">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {t('title')}
              </h1>
              <p className="text-muted-foreground">{t('subtitle')}</p>
            </div>
            <InvitationAcceptForm
              token={token}
              email={invitation.email}
              wineryName={invitation.wineryName ?? ''}
            />
          </NextIntlClientProvider>
        )}
      </div>
    </div>
  );
}
