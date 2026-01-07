import type { Winery, WineryStatus } from '@prisma/client';

export type { Winery, WineryStatus };

/**
 * Winery data for display purposes (excludes sensitive fields)
 */
export interface WineryPublic {
  id: string;
  name: string;
  slug: string;
  description: string;
  commune: string;
}

/**
 * Winery with status information
 */
export interface WineryWithStatus extends WineryPublic {
  status: WineryStatus;
}
