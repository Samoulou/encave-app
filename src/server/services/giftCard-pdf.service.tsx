import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { format } from 'date-fns';
import { fr, de, enUS } from 'date-fns/locale';
import type { Locale } from '@prisma/client';
import type { GiftCardVariant } from '@/lib/constants/gift-card';

/**
 * Personalised gift-card PDF (P-09 / L-082, PRD §13.2). Three chart
 * variants (decision 2026-07-12): Noël / anniversaire / neutre — same
 * layout, different accent + eyebrow. Attached to emails #6 and #7.
 * Self-contained trilingual labels (the PDF has no i18n runtime).
 */

const ACCENT: Record<GiftCardVariant, { accent: string; wash: string }> = {
  NOEL: { accent: '#7f1d1d', wash: '#fbf1f1' },
  ANNIVERSAIRE: { accent: '#9f2448', wash: '#faf6f7' },
  NEUTRE: { accent: '#1f1720', wash: '#f6f4f5' },
};

type Labels = {
  eyebrow: Record<GiftCardVariant, string>;
  title: string;
  valueLabel: string;
  experienceLabel: string;
  codeLabel: string;
  fromLabel: string;
  validityLabel: string;
  redeemHint: string;
};

const LABELS: Record<Locale, Labels> = {
  FR: {
    eyebrow: {
      NOEL: 'Joyeux Noël',
      ANNIVERSAIRE: 'Joyeux anniversaire',
      NEUTRE: 'Un cadeau pour vous',
    },
    title: 'Bon cadeau EnCave',
    valueLabel: 'Valeur',
    experienceLabel: 'Expérience',
    codeLabel: 'Code à utiliser au paiement',
    fromLabel: 'De la part de',
    validityLabel: 'Valable jusqu’au',
    redeemHint: 'À utiliser sur encave.ch — en une ou plusieurs fois.',
  },
  DE: {
    eyebrow: {
      NOEL: 'Frohe Weihnachten',
      ANNIVERSAIRE: 'Herzlichen Glückwunsch',
      NEUTRE: 'Ein Geschenk für Sie',
    },
    title: 'EnCave Geschenkgutschein',
    valueLabel: 'Wert',
    experienceLabel: 'Erlebnis',
    codeLabel: 'Code beim Bezahlen eingeben',
    fromLabel: 'Von',
    validityLabel: 'Gültig bis',
    redeemHint: 'Einlösbar auf encave.ch — ganz oder in Teilen.',
  },
  EN: {
    eyebrow: {
      NOEL: 'Merry Christmas',
      ANNIVERSAIRE: 'Happy birthday',
      NEUTRE: 'A gift for you',
    },
    title: 'EnCave gift card',
    valueLabel: 'Value',
    experienceLabel: 'Experience',
    codeLabel: 'Code to use at checkout',
    fromLabel: 'From',
    validityLabel: 'Valid until',
    redeemHint: 'Redeemable on encave.ch — in one or several visits.',
  },
};

const DATE_LOCALES: Record<Locale, typeof fr> = { FR: fr, DE: de, EN: enUS };

function formatCHF(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

function formatGiftCode(code: string): string {
  return code.replace(/(.{4})/g, '$1 ').trim();
}

const styles = StyleSheet.create({
  page: {
    padding: 44,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1f1720',
  },
  frame: {
    borderWidth: 1,
    borderColor: '#e3d4d9',
    borderRadius: 10,
    padding: 32,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
  },
  valueBox: {
    padding: 18,
    borderRadius: 8,
    marginBottom: 22,
  },
  valueLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#7c5a65',
    marginBottom: 4,
  },
  valueAmount: {
    fontSize: 34,
    fontFamily: 'Helvetica-Bold',
  },
  experience: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  message: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#4a3b41',
    marginBottom: 22,
    lineHeight: 1.5,
  },
  codeBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c9b3ba',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#7c5a65',
    marginBottom: 6,
  },
  codeValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaLabel: {
    fontSize: 9,
    color: '#915564',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  hint: {
    marginTop: 20,
    fontSize: 9,
    color: '#7c5a65',
    textAlign: 'center',
  },
  brand: {
    marginTop: 26,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#9f2448',
  },
});

export interface GiftCardPdfData {
  code: string;
  /** Card value in cents (initial amount). */
  amountCents: number;
  variant: GiftCardVariant;
  locale: Locale;
  purchaserName: string;
  recipientName?: string | null;
  message?: string | null;
  expiresAt: Date;
  /** Set for a nominatif EXPERIENCE gift. */
  experienceTitle?: string | null;
}

function GiftCardDocument({ data }: { data: GiftCardPdfData }) {
  const labels = LABELS[data.locale];
  const theme = ACCENT[data.variant];
  const dateLocale = DATE_LOCALES[data.locale];

  return (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>
            {labels.eyebrow[data.variant]}
          </Text>
          <Text style={styles.title}>{labels.title}</Text>

          <View style={[styles.valueBox, { backgroundColor: theme.wash }]}>
            {data.experienceTitle ? (
              <>
                <Text style={styles.valueLabel}>{labels.experienceLabel}</Text>
                <Text style={styles.experience}>{data.experienceTitle}</Text>
                <Text style={[styles.valueLabel, { marginTop: 10 }]}>
                  {labels.valueLabel}
                </Text>
                <Text style={[styles.valueAmount, { color: theme.accent }]}>
                  {formatCHF(data.amountCents)}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.valueLabel}>{labels.valueLabel}</Text>
                <Text style={[styles.valueAmount, { color: theme.accent }]}>
                  {formatCHF(data.amountCents)}
                </Text>
              </>
            )}
          </View>

          {data.message ? (
            <Text style={styles.message}>« {data.message} »</Text>
          ) : null}

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{labels.codeLabel}</Text>
            <Text style={[styles.codeValue, { color: theme.accent }]}>
              {formatGiftCode(data.code)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>{labels.fromLabel}</Text>
              <Text style={styles.metaValue}>{data.purchaserName}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>{labels.validityLabel}</Text>
              <Text style={styles.metaValue}>
                {format(data.expiresAt, 'd MMMM yyyy', { locale: dateLocale })}
              </Text>
            </View>
          </View>

          <Text style={styles.hint}>{labels.redeemHint}</Text>
          <Text style={styles.brand}>EnCave</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateGiftCardPDF(
  data: GiftCardPdfData
): Promise<Buffer> {
  return renderToBuffer(<GiftCardDocument data={data} />);
}
