import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { formatEmailDate, formatEmailPrice } from '../utils';
import { t, common, manualRefund, subjects } from '../translations';

interface ManualRefundClientEmailProps {
  locale: Locale;
  firstName: string;
  reference: string;
  experienceTitle: string;
  amountCents: number;
}

export function ManualRefundClientEmail({
  locale,
  firstName,
  reference,
  experienceTitle,
  amountCents,
}: ManualRefundClientEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.manualRefundClient, locale)}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(manualRefund.client.title, locale)}
      </Text>
      <Text>
        {t(common.greeting, locale)} {firstName},
      </Text>
      <Text>
        {t(manualRefund.client.intro, locale)
          .replace('{amount}', formatEmailPrice(amountCents))
          .replace('{reference}', reference)
          .replace('{experienceTitle}', experienceTitle)}
      </Text>
      <Text>{t(manualRefund.client.timing, locale)}</Text>
      <Text>{t(common.team, locale)}</Text>
    </EmailLayout>
  );
}

interface ManualRefundWinemakerEmailProps {
  locale: Locale;
  firstName: string;
  reference: string;
  experienceTitle: string;
  date: Date;
  amountCents: number;
  reason: string;
}

export function ManualRefundWinemakerEmail({
  locale,
  firstName,
  reference,
  experienceTitle,
  date,
  amountCents,
  reason,
}: ManualRefundWinemakerEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.manualRefundWinemaker, locale)}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(manualRefund.winemaker.title, locale)}
      </Text>
      <Text>
        {t(common.greeting, locale)} {firstName},
      </Text>
      <Text>
        {t(manualRefund.winemaker.intro, locale)
          .replace('{reference}', reference)
          .replace('{experienceTitle}', experienceTitle)
          .replace('{date}', formatEmailDate(date, locale))
          .replace('{amount}', formatEmailPrice(amountCents))}
      </Text>
      <Text>
        {t(manualRefund.winemaker.reason, locale).replace('{reason}', reason)}
      </Text>
      <Text>{t(manualRefund.winemaker.deduction, locale)}</Text>
      <Text>{t(common.team, locale)}</Text>
    </EmailLayout>
  );
}
