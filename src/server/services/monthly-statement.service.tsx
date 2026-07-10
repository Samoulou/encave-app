import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { formatCHFCompact } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import type { MonthlyStatementData } from '@/server/queries/earnings.queries';

/**
 * Monthly statement PDF (P-13 / L-142), localized to the winemaker's
 * locale. Rendered server-side with a local dictionary: @react-pdf runs
 * outside the next-intl request context, and the copy is
 * statement-specific anyway.
 */

export type StatementLocale = 'fr' | 'de' | 'en';

const DICT = {
  fr: {
    title: 'Relevé mensuel',
    generated: 'Généré le',
    summary: 'Synthèse du mois',
    gross: 'Chiffre d’affaires brut',
    commission: 'Commission EnCave',
    serviceFees: 'Frais de service client (perçus par EnCave)',
    noShowFees: 'Frais no-show',
    refunds: 'Remboursements',
    net: 'Net reversé',
    bookings: 'Réservations du mois',
    colDate: 'Date',
    colReference: 'Référence',
    colExperience: 'Expérience',
    colGuests: 'Pers.',
    colGross: 'Brut',
    colCommission: 'Commission',
    colNet: 'Net',
    refundedMark: 'remboursé',
    empty: 'Aucune réservation sur ce mois.',
    note: 'Les frais de service client sont perçus par EnCave et n’entrent pas dans votre net. Les dates et montants exacts des virements figurent sur votre page Reversements et dans votre dashboard Stripe.',
    footer: 'Généré via la plateforme EnCave — encave.ch',
  },
  de: {
    title: 'Monatsabrechnung',
    generated: 'Erstellt am',
    summary: 'Monatsübersicht',
    gross: 'Bruttoumsatz',
    commission: 'EnCave-Kommission',
    serviceFees: 'Servicegebühren der Gäste (durch EnCave erhoben)',
    noShowFees: 'No-Show-Gebühren',
    refunds: 'Erstattungen',
    net: 'Netto ausgezahlt',
    bookings: 'Reservierungen des Monats',
    colDate: 'Datum',
    colReference: 'Referenz',
    colExperience: 'Erlebnis',
    colGuests: 'Pers.',
    colGross: 'Brutto',
    colCommission: 'Kommission',
    colNet: 'Netto',
    refundedMark: 'erstattet',
    empty: 'Keine Reservierung in diesem Monat.',
    note: 'Die Servicegebühren der Gäste werden von EnCave erhoben und sind nicht Teil Ihres Nettobetrags. Die genauen Auszahlungsdaten und -beträge finden Sie auf Ihrer Auszahlungsseite und in Ihrem Stripe-Dashboard.',
    footer: 'Erstellt über die EnCave-Plattform — encave.ch',
  },
  en: {
    title: 'Monthly statement',
    generated: 'Generated on',
    summary: 'Month summary',
    gross: 'Gross revenue',
    commission: 'EnCave commission',
    serviceFees: 'Client service fees (collected by EnCave)',
    noShowFees: 'No-show fees',
    refunds: 'Refunds',
    net: 'Net paid out',
    bookings: 'Bookings of the month',
    colDate: 'Date',
    colReference: 'Reference',
    colExperience: 'Experience',
    colGuests: 'Guests',
    colGross: 'Gross',
    colCommission: 'Commission',
    colNet: 'Net',
    refundedMark: 'refunded',
    empty: 'No booking this month.',
    note: 'Client service fees are collected by EnCave and are not part of your net. Exact payout dates and amounts live on your Payouts page and in your Stripe dashboard.',
    footer: 'Generated via the EnCave platform — encave.ch',
  },
} as const;

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#1a0f12',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  wineryName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#962a48',
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1a0f12',
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e5d2d7',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#475569',
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1a0f12',
  },
  summaryValueRed: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#962a48',
  },
  netLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1a0f12',
  },
  netValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f2e9eb',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5d2d7',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    fontSize: 9,
    color: '#334155',
  },
  tableCellMuted: {
    fontSize: 9,
    color: '#94a3b8',
  },
  colDate: { width: '10%' },
  colReference: { width: '18%' },
  colExperience: { width: '30%' },
  colGuests: { width: '7%', textAlign: 'center' },
  colGross: { width: '12%', textAlign: 'right' },
  colCommission: { width: '12%', textAlign: 'right' },
  colNet: { width: '11%', textAlign: 'right' },
  note: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
  },
  noteText: {
    fontSize: 8,
    color: '#92400e',
  },
  emptyText: {
    fontSize: 10,
    color: '#64748b',
    paddingVertical: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

const chf = formatCHFCompact;

interface MonthlyStatementProps {
  wineryName: string;
  data: MonthlyStatementData;
  locale: StatementLocale;
  generatedAt: Date;
}

function MonthlyStatement({
  wineryName,
  data,
  locale,
  generatedAt,
}: MonthlyStatementProps) {
  const t = DICT[locale];
  const [yearStr, monthStr] = data.month.split('-');
  // UTC noon: immune to timezone off-by-one when naming the month.
  const monthDate = new Date(
    Date.UTC(Number(yearStr), Number(monthStr) - 1, 1, 12)
  );
  const monthLabel = formatDate(monthDate, locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{monthLabel}</Text>
          <Text style={styles.wineryName}>{wineryName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.summary}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.gross}</Text>
            <Text style={styles.summaryValue}>{chf(data.grossCents)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.commission}</Text>
            <Text style={styles.summaryValueRed}>
              -{chf(data.commissionCents)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.serviceFees}</Text>
            <Text style={styles.summaryValue}>
              {chf(data.serviceFeesCents)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.noShowFees}</Text>
            <Text style={styles.summaryValue}>{chf(data.noShowFeesCents)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t.refunds}</Text>
            <Text style={styles.summaryValueRed}>
              -{chf(data.refundedCents)}
            </Text>
          </View>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>{t.net}</Text>
            <Text style={styles.netValue}>{chf(data.netCents)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t.bookings} ({data.lines.length})
          </Text>
          {data.lines.length === 0 ? (
            <Text style={styles.emptyText}>{t.empty}</Text>
          ) : (
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colDate]}>
                  {t.colDate}
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colReference]}>
                  {t.colReference}
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colExperience]}>
                  {t.colExperience}
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colGuests]}>
                  {t.colGuests}
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colGross]}>
                  {t.colGross}
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colCommission]}>
                  {t.colCommission}
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colNet]}>
                  {t.colNet}
                </Text>
              </View>
              {data.lines.map((line) => (
                <View key={line.reference} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.colDate]}>
                    {formatDate(line.date, locale, {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    })}
                  </Text>
                  <Text style={[styles.tableCell, styles.colReference]}>
                    {line.reference}
                  </Text>
                  <Text style={[styles.tableCell, styles.colExperience]}>
                    {line.experienceTitle.length > 34
                      ? `${line.experienceTitle.slice(0, 34)}...`
                      : line.experienceTitle}
                    {line.refunded ? ` (${t.refundedMark})` : ''}
                  </Text>
                  <Text style={[styles.tableCell, styles.colGuests]}>
                    {line.guestCount}
                  </Text>
                  <Text style={[styles.tableCell, styles.colGross]}>
                    {chf(line.grossCents)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colCommission]}>
                    -{chf(line.commissionCents)}
                  </Text>
                  <Text
                    style={[
                      line.refunded ? styles.tableCellMuted : styles.tableCell,
                      styles.colNet,
                    ]}
                  >
                    {chf(line.netCents)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>{t.note}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t.generated} {formatDate(generatedAt, locale)} — {t.footer}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateMonthlyStatementPDF(
  wineryName: string,
  data: MonthlyStatementData,
  locale: StatementLocale
): Promise<Buffer> {
  return renderToBuffer(
    <MonthlyStatement
      wineryName={wineryName}
      data={data}
      locale={locale}
      generatedAt={new Date()}
    />
  );
}
