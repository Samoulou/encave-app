import { cache } from 'react';
import type { UserRole } from '@prisma/client';
import { db } from '@/server/db';
import type { AdminHistoryEntry } from '@/server/queries/admin-wineries.queries';

/**
 * Admin user reads (P-15 / L-162): searchable clients + winemakers list and
 * the per-user admin-action history. Request-level `cache()`.
 */

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  suspended: boolean;
  anonymized: boolean;
  ownsWinery: boolean;
  createdAt: string;
}

export const getUsersForAdmin = cache(
  async (params: { q?: string; role?: UserRole }): Promise<AdminUserRow[]> => {
    const q = params.q?.trim() ?? '';
    const users = await db.user.findMany({
      where: {
        ...(params.role ? { role: params.role } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        suspendedAt: true,
        anonymizedAt: true,
        createdAt: true,
        winery: { select: { id: true } },
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      suspended: user.suspendedAt !== null,
      anonymized: user.anonymizedAt !== null,
      ownsWinery: user.winery !== null,
      createdAt: user.createdAt.toISOString(),
    }));
  }
);

/**
 * Newest-first admin-action history for several users at once (suspend, role
 * change, anonymization…), keyed by userId. ONE query for the whole list —
 * reuses the shared AdminHistoryEntry timeline shape.
 */
export const getUserHistories = cache(
  async (userIds: string[]): Promise<Record<string, AdminHistoryEntry[]>> => {
    if (userIds.length === 0) return {};
    const actions = await db.adminAction.findMany({
      where: { targetType: 'User', targetId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        status: true,
        adminId: true,
        reason: true,
        targetId: true,
        createdAt: true,
      },
    });

    const byUser: Record<string, AdminHistoryEntry[]> = {};
    for (const action of actions) {
      (byUser[action.targetId] ??= []).push({
        id: action.id,
        action: action.action,
        status: action.status,
        reason: action.reason,
        adminId: action.adminId,
        at: action.createdAt.toISOString(),
      });
    }
    return byUser;
  }
);
