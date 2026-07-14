'use client';

import { RequestForm } from './RequestForm';
import type { RequestableWinery } from '@/server/queries/request.queries';

/**
 * Global /sur-mesure form (P-10 / L-090): the client picks a verified
 * winery, then describes the project. Thin client-island wrapper around
 * the shared RequestForm in full mode.
 */
export function SurMesureForm({ wineries }: { wineries: RequestableWinery[] }) {
  return <RequestForm wineries={wineries} variant="full" />;
}
