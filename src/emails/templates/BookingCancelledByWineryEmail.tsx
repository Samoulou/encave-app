import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailDate, formatEmailPrice } from '../utils';

interface BookingCancelledByWineryEmailProps {
  locale: Locale;
  guestName: string;
  winemakerName: string;
  experienceTitle: string;
  date: Date;
  amountCents: number;
  reason: string;
  experiencesUrl: string;
}

export function BookingCancelledByWineryEmail({
  locale,
  guestName,
  winemakerName,
  experienceTitle,
  date,
  amountCents,
  reason,
  experiencesUrl,
}: BookingCancelledByWineryEmailProps) {
  return (
    <EmailLayout locale={locale} preview="Votre experience a ete annulee">
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        Votre encaveur a du annuler
      </Text>
      <Text>Bonjour {guestName},</Text>
      <Text>
        Nous sommes desoles : {winemakerName} a du annuler la session &quot;
        {experienceTitle}&quot; prevue le {formatEmailDate(date, locale)}.
      </Text>
      <Text>Motif communique : &quot;{reason}&quot;</Text>
      <Text>
        Vous etes integralement rembourse. Le montant de{' '}
        {formatEmailPrice(amountCents)} sera credite sur votre moyen de paiement
        sous 5 a 10 jours ouvres selon votre banque.
      </Text>
      <EmailButton href={experiencesUrl}>
        Decouvrir d&apos;autres experiences
      </EmailButton>
      <Text>Avec nos excuses,</Text>
      <Text>L&apos;equipe EnCave</Text>
    </EmailLayout>
  );
}
