import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, request, subjects } from '../translations';

export interface RequestSlaEscalationEmailProps {
  locale: Locale;
  wineryName: string;
  clientName: string;
  clientEmail: string;
  requestReference: string;
  guestCount: number;
  /** Pre-formatted request creation date. */
  createdAt: string;
  inboxUrl: string;
}

/**
 * Escalation email (P-10 / US-240): a sur-mesure request left unanswered
 * past the 48h SLA, sent to the admin. Internal, sober tone. Locale is
 * always FR in practice (fixed by the caller).
 */
export function RequestSlaEscalationEmail({
  locale,
  wineryName,
  clientName,
  clientEmail,
  requestReference,
  guestCount,
  createdAt,
  inboxUrl,
}: RequestSlaEscalationEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.requestSlaEscalation, locale).replace(
        '{wineryName}',
        wineryName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(request.slaEscalation.title, locale)}
      </Text>
      <Text>
        {t(request.slaEscalation.intro, locale).replace(
          '{wineryName}',
          wineryName
        )}
      </Text>

      <Section
        style={{
          margin: '20px 0',
          padding: '16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
        }}
      >
        <Text style={{ margin: '0 0 4px 0' }}>
          {t(request.slaEscalation.winery, locale).replace(
            '{name}',
            wineryName
          )}
        </Text>
        <Text style={{ margin: '0 0 4px 0' }}>
          {t(request.slaEscalation.client, locale)
            .replace('{name}', clientName)
            .replace('{email}', clientEmail)}
        </Text>
        <Text style={{ margin: '0 0 4px 0' }}>
          {t(request.slaEscalation.reference, locale).replace(
            '{reference}',
            requestReference
          )}
        </Text>
        <Text style={{ margin: '0 0 4px 0' }}>
          {t(request.slaEscalation.guests, locale).replace(
            '{count}',
            String(guestCount)
          )}
        </Text>
        <Text style={{ margin: 0 }}>
          {t(request.slaEscalation.createdAt, locale).replace(
            '{date}',
            createdAt
          )}
        </Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={inboxUrl} variant="secondary">
          {t(request.slaEscalation.cta, locale)}
        </EmailButton>
      </Section>
    </EmailLayout>
  );
}
