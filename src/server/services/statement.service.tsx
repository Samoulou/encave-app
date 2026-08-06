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
import type {
  YearToDateSummary,
  Transaction,
} from '@/server/queries/earnings.queries';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  wineryName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#7f1d1d',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  summaryCard: {
    width: '45%',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  summaryValueGreen: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
  },
  summaryValueRed: {
    fontSize: 9,
    color: '#dc2626',
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    fontSize: 9,
    color: '#334155',
  },
  colDate: { width: '12%' },
  colExperience: { width: '28%' },
  colGuests: { width: '10%', textAlign: 'center' },
  colGross: { width: '15%', textAlign: 'right' },
  colFee: { width: '15%', textAlign: 'right' },
  colNet: { width: '15%', textAlign: 'right' },
  colStatus: { width: '5%', textAlign: 'center' },
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
  taxNote: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
  },
  taxNoteText: {
    fontSize: 9,
    color: '#92400e',
  },
});

// Format amount in cents to CHF string
function formatCHF(amountInCents: number): string {
  return `CHF ${(amountInCents / 100).toFixed(2)}`;
}

interface EarningsStatementProps {
  wineryName: string;
  year: number;
  summary: YearToDateSummary;
  transactions: Transaction[];
  generatedAt: Date;
}

// PDF Document Component
function EarningsStatement({
  wineryName,
  year,
  summary,
  transactions,
  generatedAt,
}: EarningsStatementProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Earnings Statement</Text>
          <Text style={styles.subtitle}>Year-to-Date Summary {year}</Text>
          <Text style={styles.wineryName}>{wineryName}</Text>
        </View>

        {/* Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Gross Revenue</Text>
              <Text style={styles.summaryValue}>
                {formatCHF(summary.grossRevenue)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Platform Fees</Text>
              <Text style={styles.summaryValueRed}>
                -{formatCHF(summary.platformFees)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Net Earnings</Text>
              <Text style={styles.summaryValueGreen}>
                {formatCHF(summary.netEarnings)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Bookings</Text>
              <Text style={styles.summaryValue}>{summary.totalBookings}</Text>
            </View>
          </View>
          {summary.refundedAmount > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.summaryValueRed}>
                Refunded: {formatCHF(summary.refundedAmount)}
              </Text>
            </View>
          )}
        </View>

        {/* Transactions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Transactions ({transactions.length})
          </Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.colExperience]}>
                Experience
              </Text>
              <Text style={[styles.tableHeaderCell, styles.colGuests]}>
                Guests
              </Text>
              <Text style={[styles.tableHeaderCell, styles.colGross]}>
                Gross
              </Text>
              <Text style={[styles.tableHeaderCell, styles.colFee]}>Fee</Text>
              <Text style={[styles.tableHeaderCell, styles.colNet]}>Net</Text>
              <Text style={[styles.tableHeaderCell, styles.colStatus]}></Text>
            </View>

            {/* Table Rows - limit to first 50 for PDF size */}
            {transactions.slice(0, 50).map((t) => (
              <View key={t.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDate]}>
                  {format(t.date, 'MMM d')}
                </Text>
                <Text style={[styles.tableCell, styles.colExperience]}>
                  {t.experienceTitle.length > 30
                    ? `${t.experienceTitle.slice(0, 30)}...`
                    : t.experienceTitle}
                </Text>
                <Text style={[styles.tableCell, styles.colGuests]}>
                  {t.guestCount}
                </Text>
                <Text style={[styles.tableCell, styles.colGross]}>
                  {formatCHF(t.grossAmount)}
                </Text>
                <Text style={[styles.tableCell, styles.colFee]}>
                  -{formatCHF(t.platformFee)}
                </Text>
                <Text style={[styles.tableCell, styles.colNet]}>
                  {formatCHF(t.netPayout)}
                </Text>
                <Text style={[styles.tableCell, styles.colStatus]}>
                  {t.status === 'completed'
                    ? 'C'
                    : t.status === 'upcoming'
                      ? '...'
                      : 'R'}
                </Text>
              </View>
            ))}
            {transactions.length > 50 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>
                  ... and {transactions.length - 50} more transactions
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Tax Note */}
        <View style={styles.taxNote}>
          <Text style={styles.taxNoteText}>
            For tax purposes, please consult your accountant. Full records of
            all transactions are available in your Stripe dashboard.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated on {format(generatedAt, 'MMMM d, yyyy')} via EnCave
            Platform
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Generate PDF earnings statement and return as Buffer
 */
export async function generateEarningsStatementPDF(
  wineryName: string,
  year: number,
  summary: YearToDateSummary,
  transactions: Transaction[]
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <EarningsStatement
      wineryName={wineryName}
      year={year}
      summary={summary}
      transactions={transactions}
      generatedAt={new Date()}
    />
  );

  return buffer;
}
