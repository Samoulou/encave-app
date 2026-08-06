'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import type { ActionResult, ErrorCode } from '@/types/actions';
import { logError, logInfo } from '@/lib/logger';
import {
  createWineSchema,
  updateWineSchema,
  deleteWineSchema,
} from '@/lib/validators/wine';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { invalidateWineryCaches } from './winery-helpers';

/**
 * Winemaker wine catalogue CRUD (P-07 / L-060). Every action: auth →
 * TASTING_SHEET flag → safeParse → ownership (winery.userId) → mutation
 * → cache invalidation. The public winery page lists available wines,
 * hence invalidateWineryCaches on every mutation.
 */

interface OwnedWinery {
  id: string;
  slug: string;
}

async function loadOwnedWinery(userId: string): Promise<OwnedWinery | null> {
  return db.winery.findUnique({
    where: { userId },
    select: { id: true, slug: true },
  });
}

type WineGateFailure = {
  success: false;
  error: { code: ErrorCode; message: string };
};

async function wineActionGate(): Promise<
  | { ok: true; userId: string; winery: OwnedWinery }
  | { ok: false; failure: WineGateFailure }
> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      failure: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      },
    };
  }
  if (!(await isFlagEnabled('TASTING_SHEET'))) {
    return {
      ok: false,
      failure: {
        success: false,
        error: { code: 'FORBIDDEN', message: 'This feature is not available' },
      },
    };
  }
  const winery = await loadOwnedWinery(session.user.id);
  if (!winery) {
    return {
      ok: false,
      failure: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      },
    };
  }
  return { ok: true, userId: session.user.id, winery };
}

export async function createWine(
  input: unknown
): Promise<ActionResult<{ wineId: string }>> {
  try {
    const gate = await wineActionGate();
    if (!gate.ok) return gate.failure;
    const parsed = createWineSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid wine' },
      };
    }

    const wine = await db.wine.create({
      data: { ...parsed.data, wineryId: gate.winery.id },
      select: { id: true },
    });
    invalidateWineryCaches(gate.winery.slug);
    logInfo('wine.created', {
      action: 'createWine',
      wineId: wine.id,
      wineryId: gate.winery.id,
      userId: gate.userId,
    });
    return { success: true, data: { wineId: wine.id } };
  } catch (error) {
    logError('createWine error', error, { action: 'createWine' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}

export async function updateWine(
  input: unknown
): Promise<ActionResult<{ wineId: string }>> {
  try {
    const gate = await wineActionGate();
    if (!gate.ok) return gate.failure;
    const parsed = updateWineSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid wine' },
      };
    }
    const { wineId, ...fields } = parsed.data;

    // Tenant-scoped write: the winery filter makes a foreign wineId a no-op.
    const updated = await db.wine.updateMany({
      where: { id: wineId, wineryId: gate.winery.id },
      data: fields,
    });
    if (updated.count === 0) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Wine not found' },
      };
    }
    invalidateWineryCaches(gate.winery.slug);
    logInfo('wine.updated', {
      action: 'updateWine',
      wineId,
      wineryId: gate.winery.id,
      userId: gate.userId,
    });
    return { success: true, data: { wineId } };
  } catch (error) {
    logError('updateWine error', error, { action: 'updateWine' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}

export async function deleteWine(
  input: unknown
): Promise<ActionResult<{ wineId: string }>> {
  try {
    const gate = await wineActionGate();
    if (!gate.ok) return gate.failure;
    const parsed = deleteWineSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid wine' },
      };
    }

    const wine = await db.wine.findFirst({
      where: { id: parsed.data.wineId, wineryId: gate.winery.id },
      select: {
        id: true,
        _count: { select: { bookingWines: true, orderRequestItems: true } },
      },
    });
    if (!wine) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Wine not found' },
      };
    }
    // Tasting/order history must survive: a served or ordered wine is
    // never deleted (BookingWine feeds pending recaps; order-request
    // items carry a RESTRICT FK). Mark it unavailable instead — the UI
    // offers exactly that on CONFLICT.
    if (wine._count.bookingWines > 0 || wine._count.orderRequestItems > 0) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'This wine was served during a tasting',
        },
      };
    }

    await db.wine.delete({ where: { id: wine.id } });
    invalidateWineryCaches(gate.winery.slug);
    logInfo('wine.deleted', {
      action: 'deleteWine',
      wineId: wine.id,
      wineryId: gate.winery.id,
      userId: gate.userId,
    });
    return { success: true, data: { wineId: wine.id } };
  } catch (error) {
    logError('deleteWine error', error, { action: 'deleteWine' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}
