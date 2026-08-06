import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { formatEmailDate, formatEmailPrice } from '../utils';
import { t, common, noShowFeeCharged, subjects } from '../translations';

interface NoShowFeeChargedEmailProps {
  locale: Locale;
  firstName: string;
  reference: string;
  experienceTitle: string;
  wineryName: string;
  date: Date;
  amountCents: number;
  acceptedAt: Date;
}

/**
 * Email #13 (P-08, US-220): sent to the client when the winemaker charges the
 * accepted no-show fee. Cites the amount, the booking, and when the client
 * accepted the policy — never a surprise.
 */
export function NoShowFeeChargedEmail({
  locale,
  firstName,
  reference,
  experienceTitle,
  wineryName,
  date,
  amountCents,
  acceptedAt,
}: NoShowFeeChargedEmailProps) {
  return (
    <EmailLayout locale={locale} preview={t(subjects.noShowFeeCharged, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(noShowFeeCharged.title, locale)}
      </Text>
      <Text>
        {t(common.greeting, locale)} {firstName},
      </Text>
      <Text>
        {t(noShowFeeCharged.intro, locale)
          .replace('{firstName}', firstName)
          .replace('{reference}', reference)
          .replace('{experienceTitle}', experienceTitle)
          .replace('{wineryName}', wineryName)
          .replace('{date}', formatEmailDate(date, locale))
          .replace('{amount}', formatEmailPrice(amountCents))}
      </Text>
      <Text>
        {t(noShowFeeCharged.policy, locale).replace(
          '{acceptedDate}',
          formatEmailDate(acceptedAt, locale)
        )}
      </Text>
      <Text>{t(noShowFeeCharged.contact, locale)}</Text>
      <Text>{t(common.team, locale)}</Text>
    </EmailLayout>
  );
}
