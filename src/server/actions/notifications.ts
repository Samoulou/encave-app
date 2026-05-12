'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  notificationPreferencesSchema,
  type NotificationPreferencesInput,
} from '@/lib/validators/notifications';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';

export async function updateNotificationPreferences(
  input: NotificationPreferencesInput
): Promise<ActionResult<{ updatedAt: Date }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You must be logged in' },
      };
    }

    // Validate input
    const parsed = notificationPreferencesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
      };
    }

    // Get the user's winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      include: { notificationPreferences: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Update or create notification preferences
    const preferences = await db.notificationPreferences.upsert({
      where: { wineryId: winery.id },
      update: {
        dailyDigest: parsed.data.dailyDigest,
        weeklySummary: parsed.data.weeklySummary,
        instantBookingAlerts: parsed.data.instantBookingAlerts,
      },
      create: {
        wineryId: winery.id,
        dailyDigest: parsed.data.dailyDigest,
        weeklySummary: parsed.data.weeklySummary,
        instantBookingAlerts: parsed.data.instantBookingAlerts,
      },
    });

    return {
      success: true,
      data: { updatedAt: preferences.updatedAt },
    };
  } catch (error) {
    logError('Error updating notification preferences', error, {
      action: 'updateNotificationPreferences',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update notification preferences',
      },
    };
  }
}

export interface NotificationPreferencesData {
  dailyDigest: boolean;
  weeklySummary: boolean;
  instantBookingAlerts: boolean;
  unsubscribeToken: string;
}

export async function getNotificationPreferences(): Promise<
  ActionResult<NotificationPreferencesData>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You must be logged in' },
      };
    }

    // Get the user's winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      include: { notificationPreferences: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Return existing preferences or defaults
    if (winery.notificationPreferences) {
      return {
        success: true,
        data: {
          dailyDigest: winery.notificationPreferences.dailyDigest,
          weeklySummary: winery.notificationPreferences.weeklySummary,
          instantBookingAlerts:
            winery.notificationPreferences.instantBookingAlerts,
          unsubscribeToken: winery.notificationPreferences.unsubscribeToken,
        },
      };
    }

    // Create default preferences
    const preferences = await db.notificationPreferences.create({
      data: {
        wineryId: winery.id,
        dailyDigest: true,
        weeklySummary: true,
        instantBookingAlerts: true,
      },
    });

    return {
      success: true,
      data: {
        dailyDigest: preferences.dailyDigest,
        weeklySummary: preferences.weeklySummary,
        instantBookingAlerts: preferences.instantBookingAlerts,
        unsubscribeToken: preferences.unsubscribeToken,
      },
    };
  } catch (error) {
    logError('Error getting notification preferences', error, {
      action: 'getNotificationPreferences',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get notification preferences',
      },
    };
  }
}
