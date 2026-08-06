import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import {
  t,
  stripeActionRequired,
  stripeRequirementLabels,
  subjects,
} from '../translations';

interface StripeActionRequiredEmailProps {
  locale: Locale;
  firstName: string;
  /** Raw Stripe `currently_due` requirement codes. */
  currentlyDue: string[];
  /** EnCave winery profile page (Stripe setup entry point). */
  profileUrl: string;
}

function requirementLabel(code: string, locale: Locale): string {
  const labels = stripeRequirementLabels[code];
  // Unknown codes are shown raw rather than hidden — the winemaker can
  // still act on them in the Stripe dashboard.
  return labels ? t(labels, locale) : code;
}

/**
 * Email #18 « Action requise Stripe » (P-13 / L-143), sent from the
 * Connect webhook when `requirements.currently_due` is non-empty —
 * anti-spam gated by shouldNotifyStripeAction (new list or 7-day
 * re-reminder).
 */
export function StripeActionRequiredEmail({
  locale,
  firstName,
  currentlyDue,
  profileUrl,
}: StripeActionRequiredEmailProps) {
  // Dedupe labels: several codes can map to the same human item.
  const labels = Array.from(
    new Set(currentlyDue.map((code) => requirementLabel(code, locale)))
  );

  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.stripeActionRequired, locale)}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(stripeActionRequired.title, locale)}
      </Text>
      <Text>
        {t(stripeActionRequired.intro, locale).replace(
          '{firstName}',
          firstName
        )}
      </Text>

      <Section
        style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '16px 24px',
          margin: '16px 0',
        }}
      >
        <Text
          style={{
            margin: '0 0 8px 0',
            fontWeight: 'bold',
            fontSize: '14px',
            color: '#92400e',
          }}
        >
          {t(stripeActionRequired.listTitle, locale)}
        </Text>
        {labels.map((label) => (
          <Text
            key={label}
            style={{ margin: '4px 0', fontSize: '14px', color: '#78350f' }}
          >
            • {label}
          </Text>
        ))}
      </Section>

      <div style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={profileUrl}>
          {t(stripeActionRequired.cta, locale)}
        </EmailButton>
      </div>

      <Text style={{ fontSize: '13px', color: '#6b7280' }}>
        {t(stripeActionRequired.note, locale)}
      </Text>
    </EmailLayout>
  );
}

export default StripeActionRequiredEmail;
