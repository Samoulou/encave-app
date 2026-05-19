import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { formatEmailDate, formatEmailPrice } from '../utils';

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
    <EmailLayout locale={locale} preview="Votre reservation a ete remboursee">
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        Votre remboursement est en route
      </Text>
      <Text>Bonjour {firstName},</Text>
      <Text>
        Nous vous confirmons le remboursement de {formatEmailPrice(amountCents)}
        pour votre reservation {reference} ({experienceTitle}).
      </Text>
      <Text>
        Les fonds reapparaitront sur votre moyen de paiement sous 5 a 10 jours
        ouvres selon votre banque.
      </Text>
      <Text>L&apos;equipe EnCave</Text>
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
    <EmailLayout locale={locale} preview="Une reservation a ete remboursee">
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        Une reservation a ete remboursee par EnCave
      </Text>
      <Text>Bonjour {firstName},</Text>
      <Text>
        L&apos;equipe EnCave a procede au remboursement de la reservation{' '}
        {reference}({experienceTitle}, le {formatEmailDate(date, locale)}) pour
        un montant de {formatEmailPrice(amountCents)}.
      </Text>
      <Text>Motif communique : {reason}.</Text>
      <Text>
        Ce montant est automatiquement deduit de votre prochain reversement
        Stripe Connect.
      </Text>
      <Text>L&apos;equipe EnCave</Text>
    </EmailLayout>
  );
}
