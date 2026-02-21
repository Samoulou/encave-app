'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { put, del } from '@vercel/blob';
import {
  IMAGE_MAX_SIZE,
  EXPERIENCE_ALLOWED_TYPES,
} from '@/lib/validators/image';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';

/**
 * Upload an experience image to Vercel Blob storage
 */
export async function uploadExperienceImage(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // Verify user has a verified winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!winery || winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only verified winemakers can upload experience images',
        },
      };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No file provided' },
      };
    }

    // Validate file
    if (file.size > IMAGE_MAX_SIZE) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Image must be less than 5MB' },
      };
    }

    if (!EXPERIENCE_ALLOWED_TYPES.includes(file.type as typeof EXPERIENCE_ALLOWED_TYPES[number])) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only JPEG, PNG, and WebP images are allowed',
        },
      };
    }

    // Upload to Vercel Blob
    const filename = `experiences/${winery.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    });

    return {
      success: true,
      data: { url: blob.url },
    };
  } catch (error) {
    logError('uploadExperienceImage error', error, { action: 'uploadExperienceImage' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to upload image. Please try again.',
      },
    };
  }
}

/**
 * Delete an uploaded image from Blob storage (for cleanup on form cancellation)
 */
export async function deleteUploadedImage(
  imageUrl: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // Verify user has a winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Only allow deleting images in this winery's folder
    if (!imageUrl.includes(`experiences/${winery.id}/`)) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot delete this image' },
      };
    }

    try {
      await del(imageUrl);
    } catch {
      // Ignore deletion errors
    }

    return {
      success: true,
      data: { deleted: true },
    };
  } catch (error) {
    logError('deleteUploadedImage error', error, { action: 'deleteUploadedImage' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}
