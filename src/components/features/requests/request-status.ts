import { RequestStatus, RequestOfferStatus } from '@prisma/client';
import { type BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export interface RequestBadge {
  /** Translation key in the `requests` namespace. */
  key: string;
  variant: BadgeVariant;
}

/** Request status → warm-brand badge (winemaker inbox + detail, P-10). */
export const REQUEST_STATUS_BADGE: Record<RequestStatus, RequestBadge> = {
  [RequestStatus.PENDING]: { key: 'statusPending', variant: 'warning' },
  [RequestStatus.OFFERED]: { key: 'statusOffered', variant: 'info' },
  [RequestStatus.PAID]: { key: 'statusPaid', variant: 'success' },
  [RequestStatus.EXPIRED]: { key: 'statusExpired', variant: 'neutral' },
  [RequestStatus.CLOSED]: { key: 'statusClosed', variant: 'neutral' },
};

/** Offer status → badge (winemaker detail, P-10). */
export const REQUEST_OFFER_STATUS_BADGE: Record<
  RequestOfferStatus,
  RequestBadge
> = {
  [RequestOfferStatus.SENT]: { key: 'offerStatusSent', variant: 'info' },
  [RequestOfferStatus.PAID]: { key: 'offerStatusPaid', variant: 'success' },
  [RequestOfferStatus.EXPIRED]: {
    key: 'offerStatusExpired',
    variant: 'neutral',
  },
  [RequestOfferStatus.WITHDRAWN]: {
    key: 'offerStatusWithdrawn',
    variant: 'neutral',
  },
};
