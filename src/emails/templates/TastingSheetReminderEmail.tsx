import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, tastingSheetReminder, subjects } from '../translations';

export interface ReminderSessionLine {
  experienceTitle: string;
  timeSlot: string;
  attendeeCount: number;
}

interface TastingSheetReminderEmailProps {
  locale: Locale;
  firstName: string;
  sessions: ReminderSessionLine[];
  /** Owner calendar of the (single or first) experience concerned. */
  sheetUrl: string;
}

/**
 * Email #21 « fiche dégustation à remplir » (P-07 / L-063), 21h Zurich
 * the evening of the session when the sheet is still empty. One email
 * per winery listing all of the day's unfilled sessions.
 */
export function TastingSheetReminderEmail({
  locale,
  firstName,
  sessions,
  sheetUrl,
}: TastingSheetReminderEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.tastingSheetReminder, locale)}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(tastingSheetReminder.title, locale)}
      </Text>
      <Text>
        {t(tastingSheetReminder.intro, locale).replace(
          '{firstName}',
          firstName
        )}
      </Text>

      <Section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px 16px',
          margin: '16px 0',
        }}
      >
        {sessions.map((session, index) => (
          <Text
            key={`${session.experienceTitle}-${session.timeSlot}-${index}`}
            style={{ margin: '8px 0', fontSize: '14px' }}
          >
            {t(tastingSheetReminder.sessionLine, locale)
              .replace('{title}', session.experienceTitle)
              .replace('{timeSlot}', session.timeSlot)
              .replace('{count}', String(session.attendeeCount))}
          </Text>
        ))}
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={sheetUrl}>
          {t(tastingSheetReminder.cta, locale)}
        </EmailButton>
      </Section>
    </EmailLayout>
  );
}
