import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { getTranslations } from 'next-intl/server';
import { formatDateShort } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';

const styles = StyleSheet.create({
  page: {
    padding: 44,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f1720',
  },
  header: {
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ead7dd',
  },
  brand: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#9f2448',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  muted: {
    color: '#7c5a65',
  },
  reference: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#faf6f7',
    borderRadius: 6,
  },
  referenceLabel: {
    fontSize: 8,
    color: '#915564',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  referenceValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#9f2448',
  },
  grid: {
    flexDirection: 'row',
    gap: 22,
    marginBottom: 24,
  },
  column: {
    flex: 1,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ead7dd',
  },
  row: {
    marginBottom: 8,
  },
  label: {
    fontSize: 8,
    color: '#915564',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  totalBox: {
    marginTop: 8,
    padding: 14,
    backgroundColor: '#faf6f7',
    borderRadius: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feeValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  totalLabel: {
    fontSize: 11,
    color: '#7c5a65',
  },
  totalValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  note: {
    marginTop: 8,
    fontSize: 8,
    color: '#7c5a65',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    left: 44,
    right: 44,
    bottom: 32,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ead7dd',
  },
  footerText: {
    fontSize: 8,
    color: '#9a7b84',
    textAlign: 'center',
  },
});

function formatCHF(amountInCents: number): string {
  return `CHF ${(amountInCents / 100).toFixed(2)}`;
}

function formatTime(time: string): string {
  const [hours = '00', minutes = '00'] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

function formatEndTime(time: string, durationMinutes: number): string {
  const [rawHours = '0', rawMinutes = '0'] = time.split(':');
  const totalMinutes =
    Number(rawHours) * 60 + Number(rawMinutes) + durationMinutes;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
}

export interface BookingReceiptData {
  reference: string;
  visitorName: string;
  visitorEmail: string;
  experienceTitle: string;
  wineryName: string;
  wineryAddress: string;
  wineryCommune: string;
  date: Date;
  timeSlot: string;
  durationMinutes: number;
  guestCount: number;
  totalPrice: number;
  /** Client booking fee in cents — 0 for bookings made with the flag OFF. */
  serviceFeeCents: number;
  generatedAt: Date;
}

interface ReceiptLabels {
  title: string;
  generatedOn: string;
  reference: string;
  client: string;
  name: string;
  email: string;
  winery: string;
  address: string;
  experience: string;
  date: string;
  time: string;
  guests: string;
  serviceFee: string;
  totalPaid: string;
  vatNote: string;
  footer: string;
}

function BookingReceipt({
  receipt,
  labels,
  formattedDate,
}: {
  receipt: BookingReceiptData;
  labels: ReceiptLabels;
  formattedDate: string;
}) {
  const formattedTime = `${formatTime(receipt.timeSlot)} - ${formatEndTime(
    receipt.timeSlot,
    receipt.durationMinutes
  )}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>EnCave</Text>
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.muted}>{labels.generatedOn}</Text>
          <View style={styles.reference}>
            <Text style={styles.referenceLabel}>{labels.reference}</Text>
            <Text style={styles.referenceValue}>{receipt.reference}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{labels.client}</Text>
              <View style={styles.row}>
                <Text style={styles.label}>{labels.name}</Text>
                <Text style={styles.value}>{receipt.visitorName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{labels.email}</Text>
                <Text style={styles.value}>{receipt.visitorEmail}</Text>
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{labels.winery}</Text>
              <View style={styles.row}>
                <Text style={styles.label}>{labels.name}</Text>
                <Text style={styles.value}>{receipt.wineryName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{labels.address}</Text>
                <Text style={styles.value}>
                  {receipt.wineryAddress}, {receipt.wineryCommune}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.experience}</Text>
          <View style={styles.grid}>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.label}>{labels.experience}</Text>
                <Text style={styles.value}>{receipt.experienceTitle}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{labels.date}</Text>
                <Text style={styles.value}>{formattedDate}</Text>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.label}>{labels.time}</Text>
                <Text style={styles.value}>{formattedTime}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{labels.guests}</Text>
                <Text style={styles.value}>{receipt.guestCount}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.totalBox}>
          {receipt.serviceFeeCents > 0 && (
            <>
              <View style={styles.feeRow}>
                <Text style={styles.totalLabel}>{labels.experience}</Text>
                <Text style={styles.feeValue}>
                  {formatCHF(receipt.totalPrice)}
                </Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.totalLabel}>{labels.serviceFee}</Text>
                <Text style={styles.feeValue}>
                  {formatCHF(receipt.serviceFeeCents)}
                </Text>
              </View>
            </>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{labels.totalPaid}</Text>
            <Text style={styles.totalValue}>
              {formatCHF(receipt.totalPrice + receipt.serviceFeeCents)}
            </Text>
          </View>
          <Text style={styles.note}>{labels.vatNote}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{labels.footer}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateBookingReceiptPDF(
  receipt: BookingReceiptData,
  locale: Locale = 'fr'
): Promise<Buffer> {
  const t = await getTranslations({ locale, namespace: 'receipt' });
  const labels: ReceiptLabels = {
    title: t('title'),
    generatedOn: t('generatedOn', {
      date: formatDateShort(receipt.generatedAt, locale),
    }),
    reference: t('reference'),
    client: t('client'),
    name: t('name'),
    email: t('email'),
    winery: t('winery'),
    address: t('address'),
    experience: t('experience'),
    date: t('date'),
    time: t('time'),
    guests: t('guests'),
    serviceFee: t('serviceFee'),
    totalPaid: t('totalPaid'),
    vatNote: t('vatNote'),
    footer: t('footer'),
  };
  return renderToBuffer(
    <BookingReceipt
      receipt={receipt}
      labels={labels}
      formattedDate={formatDateShort(receipt.date, locale)}
    />
  );
}
