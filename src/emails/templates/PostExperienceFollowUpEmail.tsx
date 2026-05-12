import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailDateShort } from '../utils';
import { t, common, postExperience, subjects } from '../translations';

export interface PostExperienceFollowUpEmailProps {
  locale: Locale;
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  date: Date;
  experiencesUrl: string;
  unsubscribeUrl?: string;
}

export function PostExperienceFollowUpEmail({
  locale,
  guestName,
  experienceTitle,
  wineryName,
  date,
  experiencesUrl,
}: PostExperienceFollowUpEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(postExperience.title, locale);
  const intro = t(postExperience.intro, locale);
  const visitedOn = t(postExperience.visitedOn, locale);
  const discoverMore = t(postExperience.discoverMore, locale);
  const discoverMoreCta = t(postExperience.discoverMoreCta, locale);
  const feedbackTitle = t(postExperience.feedbackTitle, locale);
  const feedbackText = t(postExperience.feedbackText, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.postExperience, locale)}>
      <Text
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#7c2d12',
          margin: '0 0 16px 0',
        }}
      >
        {title}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {guestName},
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>{intro}</Text>

      {/* Experience Recap */}
      <Section
        style={{
          backgroundColor: '#fef7f0',
          borderRadius: '8px',
          padding: '24px',
          margin: '0 0 24px 0',
          textAlign: 'center',
        }}
      >
        <Text
          style={{
            margin: '0 0 8px 0',
            fontWeight: 'bold',
            fontSize: '18px',
            color: '#7c2d12',
          }}
        >
          {experienceTitle}
        </Text>
        <Text style={{ margin: '0 0 4px 0', color: '#6b7280' }}>
          {wineryName}
        </Text>
        <Text style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>
          {visitedOn} {formatEmailDateShort(date, locale)}
        </Text>
      </Section>

      {/* Feedback Section */}
      <Section
        style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '20px',
          margin: '0 0 24px 0',
        }}
      >
        <Text
          style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '14px' }}
        >
          {feedbackTitle}
        </Text>
        <Text style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          {feedbackText}
        </Text>
      </Section>

      {/* Discover More */}
      <Text style={{ margin: '0 0 16px 0' }}>{discoverMore}</Text>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={experiencesUrl}>{discoverMoreCta}</EmailButton>
      </div>

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default PostExperienceFollowUpEmail;
