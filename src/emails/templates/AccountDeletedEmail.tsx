import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { formatEmailDate } from '../utils';

interface AccountDeletedEmailProps {
  locale: Locale;
  date: Date;
}

export function AccountDeletedEmail({
  locale,
  date,
}: AccountDeletedEmailProps) {
  return (
    <EmailLayout locale={locale} preview="Votre compte EnCave a ete supprime">
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        Votre compte a ete supprime
      </Text>
      <Text>
        Bonjour, nous vous confirmons la suppression de votre compte EnCave en
        date du {formatEmailDate(date, locale)}. Vos donnees personnelles ont
        ete effacees de notre plateforme.
      </Text>
      <Text>
        Conformement au droit suisse, nous conservons l&apos;historique
        anonymise de vos reservations pendant 10 ans pour des raisons
        comptables.
      </Text>
      <Text>L&apos;equipe EnCave</Text>
    </EmailLayout>
  );
}
