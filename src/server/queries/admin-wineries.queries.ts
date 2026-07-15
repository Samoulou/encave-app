import { cache } from 'react';
import type { WineryStatus } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Admin winery reads (P-15 / L-161): the all-statuses list (superset of the
 * pending-only queue) and the merged validation history. Request-level
 * `cache()` — the admin surface tolerates a fresh indexed read per load.
 */

export interface AdminWineryRow {
  id: string;
  name: string;
  slug: string;
  commune: string;
  status: WineryStatus;
  plan: string;
  contactEmail: string;
  ownerSuspended: boolean;
  createdAt: string;
}

export const getWineriesForAdmin = cache(
  async (params: {
    q?: string;
    status?: WineryStatus;
  }): Promise<AdminWineryRow[]> => {
    const q = params.q?.trim() ?? '';
    const wineries = await db.winery.findMany({
      where: {
        ...(params.status ? { status: params.status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { commune: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { user: { email: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        commune: true,
        status: true,
        plan: true,
        email: true,
        createdAt: true,
        user: { select: { email: true, suspendedAt: true } },
      },
    });

    return wineries.map((winery) => ({
      id: winery.id,
      name: winery.name,
      slug: winery.slug,
      commune: winery.commune,
      status: winery.status,
      plan: winery.plan,
      contactEmail: winery.user.email,
      ownerSuspended: winery.user.suspendedAt !== null,
      createdAt: winery.createdAt.toISOString(),
    }));
  }
);

/**
 * A single admin/audit event, unifying VerificationLog (approve/reject) and
 * AdminAction (suspend, plan change, refund, anonymize, role change…) so both
 * render in one timeline. Reused by the winery detail AND the users page.
 */
export interface AdminHistoryEntry {
  id: string;
  /** 'APPROVED' | 'REJECTED' | an AdminAction.action code. */
  action: string;
  /** AdminAction.status (SUCCESS/FAILED) — null for verification logs. */
  status: string | null;
  reason: string | null;
  adminId: string;
  at: string;
}

/**
 * Merged, newest-first validation + admin-action history for a winery.
 */
export const getWineryHistory = cache(
  async (wineryId: string): Promise<AdminHistoryEntry[]> => {
    const [verifications, actions] = await Promise.all([
      db.verificationLog.findMany({
        where: { wineryId },
        select: {
          id: true,
          action: true,
          adminId: true,
          reason: true,
          createdAt: true,
        },
      }),
      db.adminAction.findMany({
        where: { targetType: 'Winery', targetId: wineryId },
        select: {
          id: true,
          action: true,
          status: true,
          adminId: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

    const entries: AdminHistoryEntry[] = [
      ...verifications.map((log) => ({
        id: log.id,
        action: log.action,
        status: null,
        reason: log.reason,
        adminId: log.adminId,
        at: log.createdAt.toISOString(),
      })),
      ...actions.map((action) => ({
        id: action.id,
        action: action.action,
        status: action.status,
        reason: action.reason,
        adminId: action.adminId,
        at: action.createdAt.toISOString(),
      })),
    ];

    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }
);
