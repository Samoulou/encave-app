import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { subHours } from 'date-fns';
import {
  type Locale,
  type RequestStatus,
  type RequestOfferStatus,
} from '@prisma/client';
import { db } from '@/server/db';
import {
  REQUESTS_CACHE_TAG,
  REQUEST_ALERT_HOURS,
} from '@/lib/constants/request';

export interface RequestableWinery {
  id: string;
  name: string;
}

/**
 * Verified wineries the client can address a request to (P-10 / L-090). The
 * global /sur-mesure form requires a winery at launch; the fiche block
 * prefills its own, so it does not need this list.
 */
export const getRequestableWineries = cache(
  async (): Promise<RequestableWinery[]> => {
    return db.winery.findMany({
      where: { status: 'VERIFIED' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
);

export interface RequestListItem {
  id: string;
  reference: string;
  status: RequestStatus;
  clientName: string;
  guestCount: number;
  desiredDate: Date | null;
  budget: number | null;
  createdAt: Date;
  offerStatus: RequestOfferStatus | null;
}

/**
 * Winemaker inbox list (P-10 / L-091), tenant-gated on wineryId. Newest
 * first; carries the latest offer status for the row badge. Request-scoped
 * cache only (React.cache) — the badge count is the cross-request cache.
 */
export const getWineryRequests = cache(
  async (wineryId: string): Promise<RequestListItem[]> => {
    const rows = await db.request.findMany({
      where: { wineryId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reference: true,
        status: true,
        clientName: true,
        guestCount: true,
        desiredDate: true,
        budget: true,
        createdAt: true,
        offers: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      clientName: r.clientName,
      guestCount: r.guestCount,
      desiredDate: r.desiredDate,
      budget: r.budget,
      createdAt: r.createdAt,
      offerStatus: r.offers[0]?.status ?? null,
    }));
  }
);

export interface RequestDetail {
  id: string;
  reference: string;
  status: RequestStatus;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  guestCount: number;
  desiredDate: Date | null;
  budget: number | null;
  description: string;
  createdAt: Date;
  offers: {
    id: string;
    status: RequestOfferStatus;
    message: string;
    totalPrice: number;
    scheduledDate: Date | null;
    scheduledStartTime: string | null;
    expiresAt: Date;
    createdAt: Date;
  }[];
}

/** Full request detail for the inbox, tenant-gated. Null if not owned. */
export const getRequestDetail = cache(
  async (
    wineryId: string,
    requestId: string
  ): Promise<RequestDetail | null> => {
    const request = await db.request.findFirst({
      where: { id: requestId, wineryId },
      select: {
        id: true,
        reference: true,
        status: true,
        clientName: true,
        clientEmail: true,
        clientPhone: true,
        guestCount: true,
        desiredDate: true,
        budget: true,
        description: true,
        createdAt: true,
        offers: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
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
    });
    return request;
  }
);

/**
 * Unread/actionable count for the nav badge — requests still PENDING (no
 * offer sent). Cross-request cache, invalidated on every request write via
 * the REQUESTS_CACHE_TAG. Global tag → all wineries purge together (writes
 * are rare); keyed per winery through the argument.
 */
export const getPendingRequestCount = cache((wineryId: string) =>
  unstable_cache(
    async (id: string): Promise<number> =>
      db.request.count({ where: { wineryId: id, status: 'PENDING' } }),
    ['pending-request-count'],
    { tags: [REQUESTS_CACHE_TAG], revalidate: 300 }
  )(wineryId)
);

/**
 * Dashboard alert (P-10 / L-094): requests still PENDING older than 24h.
 * Not cached — it's an "as of now" age window, cheap and rarely non-empty.
 */
export const getStaleRequests = cache(
  async (wineryId: string): Promise<{ id: string; count: number }[]> => {
    const cutoff = subHours(new Date(), REQUEST_ALERT_HOURS);
    const rows = await db.request.findMany({
      where: { wineryId, status: 'PENDING', createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, count: 1 }));
  }
);

export interface PublicOfferView {
  offerId: string;
  status: RequestOfferStatus;
  wineryName: string;
  clientName: string;
  message: string;
  totalPrice: number;
  scheduledDate: Date | null;
  scheduledStartTime: string | null;
  guestCount: number;
  expiresAt: Date;
  locale: Locale;
  isPayable: boolean;
}

/**
 * Public offer view for the tokenized payment page (P-10 / L-092). Read-only
 * DTO — never exposes Stripe ids or the winery's payout details. `isPayable`
 * reflects SENT + not expired.
 */
export const getRequestOfferByToken = cache(
  async (token: string): Promise<PublicOfferView | null> => {
    const offer = await db.requestOffer.findUnique({
      where: { paymentToken: token },
      select: {
        id: true,
        status: true,
        message: true,
        totalPrice: true,
        scheduledDate: true,
        scheduledStartTime: true,
        expiresAt: true,
        request: {
          select: {
            clientName: true,
            guestCount: true,
            locale: true,
            winery: { select: { name: true } },
          },
        },
      },
    });
    if (!offer) return null;
    return {
      offerId: offer.id,
      status: offer.status,
      wineryName: offer.request.winery?.name ?? 'EnCave',
      clientName: offer.request.clientName,
      message: offer.message,
      totalPrice: offer.totalPrice,
      scheduledDate: offer.scheduledDate,
      scheduledStartTime: offer.scheduledStartTime,
      guestCount: offer.request.guestCount,
      expiresAt: offer.expiresAt,
      locale: offer.request.locale,
      isPayable:
        offer.status === 'SENT' && offer.expiresAt.getTime() > Date.now(),
    };
  }
);

export interface ClientRequestItem {
  id: string;
  reference: string;
  status: RequestStatus;
  wineryName: string;
  guestCount: number;
  desiredDate: Date | null;
  createdAt: Date;
  offer: {
    status: RequestOfferStatus;
    totalPrice: number;
    expiresAt: Date;
    paymentToken: string | null;
    scheduledDate: Date | null;
    scheduledStartTime: string | null;
  } | null;
}

/**
 * Client tracking (P-10 / L-095, Should) — requests made with the signed-in
 * user's email. Carries the latest offer + its pay token so the account page
 * can render a "Payer" CTA. Matched case-insensitively on email.
 */
export const getClientRequests = cache(
  async (email: string): Promise<ClientRequestItem[]> => {
    const rows = await db.request.findMany({
      where: { clientEmail: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reference: true,
        status: true,
        guestCount: true,
        desiredDate: true,
        createdAt: true,
        winery: { select: { name: true } },
        offers: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            totalPrice: true,
            expiresAt: true,
            paymentToken: true,
            scheduledDate: true,
            scheduledStartTime: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      wineryName: r.winery?.name ?? 'EnCave',
      guestCount: r.guestCount,
      desiredDate: r.desiredDate,
      createdAt: r.createdAt,
      offer: r.offers[0]
        ? {
            status: r.offers[0].status,
            totalPrice: r.offers[0].totalPrice,
            expiresAt: r.offers[0].expiresAt,
            paymentToken: r.offers[0].paymentToken,
            scheduledDate: r.offers[0].scheduledDate,
            scheduledStartTime: r.offers[0].scheduledStartTime,
          }
        : null,
    }));
  }
);
