import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailDate } from '../utils';

interface BookingExpiredEmailProps {
  locale: Locale;
  guestName: string;
  experienceTitle: string;
  date: Date;
  experienceUrl: string;
}

export function BookingExpiredEmail({
  guestName,
  experienceTitle,
  date,
  experienceUrl,
}: BookingExpiredEmailProps) {
  return (
    <EmailLayout locale="FR" preview="Votre reservation EnCave a expire">
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        Votre reservation a expire
      </Text>
      <Text>Bonjour {guestName},</Text>
      <Text>
        Votre paiement n&apos;a pas ete finalise dans les 30 minutes. Votre
        reservation pour {experienceTitle} le {formatEmailDate(date, 'FR')} a
        ete annulee et votre place remise en disponibilite. Aucun montant
        n&apos;a ete debite.
      </Text>
      <EmailButton href={experienceUrl}>
        Retrouver l&apos;experience
      </EmailButton>
      <Text>A tres vite chez nos encaveurs,</Text>
      <Text>L&apos;equipe EnCave</Text>
    </EmailLayout>
  );
}
