import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';

/**
 * nLPD data-portability export (art. 28): everything the platform holds
 * about ONE person — the account, and every row attached to their email
 * (guest bookings, gift cards bought or received, sur-mesure requests and
 * the offers they got, wine order requests, email preferences, newsletter).
 *
 * Email-matched tables are compared case-insensitively, like the
 * anonymization service (src/server/services/anonymization.service.ts) —
 * the two MUST cover the same tables: what can be exported is what gets
 * erased.
 *
 * Never cached (personal data, always fresh) and never exposes internals
 * that are not the person's own data: no Stripe ids, no token or token
 * hash, no winery-side fields (commission, payout). The caller is
 * responsible for the access check (session + VERIFIED email — the match is
 * by email alone).
 */
export async function buildPrivacyExport(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      role: true,
      preferredLocale: true,
      cookieConsent: true,
      anonymizedAt: true,
      suspendedAt: true,
      createdAt: true,
      updatedAt: true,
      winery: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          address: true,
          commune: true,
          phone: true,
          email: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          experiences: {
            select: {
              id: true,
              title: true,
              slug: true,
              type: true,
              duration: true,
              price: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const byEmail = {
    equals: user.email,
    mode: 'insensitive',
  } satisfies Prisma.StringFilter;

  // Common to both sides of a gift. The OTHER party's email is added only
  // where the subject supplied it themselves (a buyer typed the recipient's
  // address; a recipient never learns the buyer's — only the display name
  // already printed on the gift).
  const giftCardSelect = {
    id: true,
    code: true,
    status: true,
    initialAmount: true,
    balance: true,
    purchaserName: true,
    recipientName: true,
    message: true,
    deliverAt: true,
    deliveredAt: true,
    expiresAt: true,
    locale: true,
    createdAt: true,
    experience: { select: { title: true, slug: true } },
    transactions: {
      orderBy: { createdAt: 'asc' },
      select: { type: true, amount: true, createdAt: true },
    },
  } satisfies Prisma.GiftCardSelect;

  const [
    bookings,
    giftCardsPurchased,
    giftCardsReceived,
    requests,
    wineOrderRequests,
    emailPreference,
    newsletterSubscription,
  ] = await Promise.all([
    db.booking.findMany({
      where: { visitorEmail: byEmail },
      select: {
        id: true,
        reference: true,
        visitorEmail: true,
        visitorName: true,
        visitorPhone: true,
        date: true,
        timeSlot: true,
        guestCount: true,
        totalPrice: true,
        status: true,
        cancelledAt: true,
        cancellationReason: true,
        refundIssued: true,
        refundAmount: true,
        checkedInAt: true,
        ageConfirmedAt: true,
        ageConfirmedVersion: true,
        createdAt: true,
        updatedAt: true,
        experience: {
          select: {
            title: true,
            slug: true,
            winery: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.giftCard.findMany({
      where: { purchaserEmail: byEmail },
      select: { ...giftCardSelect, purchaserEmail: true, recipientEmail: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.giftCard.findMany({
      where: { recipientEmail: byEmail },
      select: { ...giftCardSelect, recipientEmail: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.request.findMany({
      where: { clientEmail: byEmail },
      select: {
        id: true,
        reference: true,
        status: true,
        clientEmail: true,
        clientName: true,
        clientPhone: true,
        desiredDate: true,
        guestCount: true,
        budget: true,
        description: true,
        locale: true,
        closedAt: true,
        createdAt: true,
        winery: { select: { name: true, slug: true } },
        offers: {
          orderBy: { createdAt: 'asc' },
          select: {
            status: true,
            message: true,
            totalPrice: true,
            scheduledDate: true,
            scheduledStartTime: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.wineOrderRequest.findMany({
      where: { clientEmail: byEmail },
      select: {
        id: true,
        status: true,
        clientName: true,
        clientEmail: true,
        clientPhone: true,
        createdAt: true,
        booking: { select: { reference: true } },
        winery: { select: { name: true, slug: true } },
        items: {
          select: {
            wineName: true,
            grapeVariety: true,
            vintage: true,
            priceAtRequest: true,
            quantity: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.clientEmailPreference.findFirst({
      where: { email: byEmail },
      select: {
        email: true,
        marketingOptOut: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.newsletterSubscription.findFirst({
      where: { email: byEmail },
      select: { email: true, source: true, createdAt: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    subject: {
      user,
      bookings,
      giftCardsPurchased,
      giftCardsReceived,
      requests,
      wineOrderRequests,
      emailPreference,
      newsletterSubscription,
    },
  };
}
