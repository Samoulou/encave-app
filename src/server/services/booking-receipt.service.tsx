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
  generatedAt: Date;
}

function BookingReceipt({ receipt }: { receipt: BookingReceiptData }) {
  const formattedDate = format(receipt.date, 'MMMM d, yyyy');
  const formattedTime = `${formatTime(receipt.timeSlot)} - ${formatEndTime(
    receipt.timeSlot,
    receipt.durationMinutes
  )}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>EnCave</Text>
          <Text style={styles.title}>Reçu de réservation</Text>
          <Text style={styles.muted}>
            Reçu généré le {format(receipt.generatedAt, 'MMMM d, yyyy')}
          </Text>
          <View style={styles.reference}>
            <Text style={styles.referenceLabel}>Référence</Text>
            <Text style={styles.referenceValue}>{receipt.reference}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Nom</Text>
                <Text style={styles.value}>{receipt.visitorName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{receipt.visitorEmail}</Text>
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Domaine</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Nom</Text>
                <Text style={styles.value}>{receipt.wineryName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Adresse</Text>
                <Text style={styles.value}>
                  {receipt.wineryAddress}, {receipt.wineryCommune}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expérience</Text>
          <View style={styles.grid}>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.label}>Expérience</Text>
                <Text style={styles.value}>{receipt.experienceTitle}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Date</Text>
                <Text style={styles.value}>{formattedDate}</Text>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.label}>Heure</Text>
                <Text style={styles.value}>{formattedTime}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Invités</Text>
                <Text style={styles.value}>{receipt.guestCount}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total payé</Text>
            <Text style={styles.totalValue}>
              {formatCHF(receipt.totalPrice)}
            </Text>
          </View>
          <Text style={styles.note}>
            Prix TTC. EnCave n'est pas assujettie à la TVA à ce jour.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ce reçu confirme le paiement de votre réservation EnCave.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateBookingReceiptPDF(
  receipt: BookingReceiptData
): Promise<Buffer> {
  return renderToBuffer(<BookingReceipt receipt={receipt} />);
}
