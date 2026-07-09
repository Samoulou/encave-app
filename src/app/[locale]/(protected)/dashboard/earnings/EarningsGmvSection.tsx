import { GmvHighlightCard } from '@/components/features/earnings/GmvHighlightCard';
import { getWineryGmv } from '@/server/queries/earnings.queries';

interface EarningsGmvSectionProps {
  wineryId: string;
}

/**
 * Async server component for the "EnCave vous a apporté X CHF" block
 * (P-03 / L-044). Streams independently from the other earnings sections.
 */
export async function EarningsGmvSection({
  wineryId,
}: EarningsGmvSectionProps) {
  const gmvCents = await getWineryGmv(wineryId);

  return <GmvHighlightCard gmvCents={gmvCents} />;
}
