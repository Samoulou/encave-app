'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { put, del } from '@vercel/blob';
import {
  wineryOnboardingSchema,
  wineryProfileSchema,
  type WineryOnboardingInput,
  type WineryProfileInput,
} from '@/lib/validators/winery';
import { generateSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import { geocodeWineryAddress } from '@/lib/geocoding';
import { IMAGE_MAX_SIZE, WINERY_ALLOWED_TYPES } from '@/lib/validators/image';
import type { ActionResult } from '@/types/actions';
import { logError, logWarn } from '@/lib/logger';
import { getPostHogServer } from '@/lib/posthog';

/**
 * Check if a winery slug already exists
 */
async function winerySlugExists(slug: string): Promise<boolean> {
  const existing = await db.winery.findUnique({
    where: { slug },
    select: { id: true },
  });
  return !!existing;
}

export async function createWinery(
  input: WineryOnboardingInput
): Promise<ActionResult<{ wineryId: string; slug: string }>> {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // 2. Validate input
    const validated = wineryOnboardingSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstError?.message ?? 'Invalid input',
        },
      };
    }

    const { name, description, address, commune, phone } = validated.data;

    // 3. Check if user already has a winery
    const existingUserWinery = await db.winery.findUnique({
      where: { userId: session.user.id },
    });

    if (existingUserWinery) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'You have already registered a winery',
        },
      };
    }

    // 4. Check for duplicate winery name
    const existingWineryName = await db.winery.findUnique({
      where: { name },
    });

    if (existingWineryName) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message:
            'A winery with this name already exists. Please choose a different name.',
        },
      };
    }

    // 5. Generate unique slug
    const baseSlug = generateSlug(name);
    const slug = await ensureUniqueSlug(baseSlug, winerySlugExists);

    // 6. Get user email for the winery contact
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (!user) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      };
    }

    // 7. Geocode address (non-blocking, best effort)
    let coordinates: { latitude: number; longitude: number } | null = null;
    try {
      coordinates = await geocodeWineryAddress(address, commune);
    } catch (geocodeError) {
      // Log but don't fail - geocoding is optional
      logWarn('Geocoding failed for new winery', {
        action: 'createWinery',
        error: geocodeError,
      });
    }

    // 8. Create winery and update user role in a transaction
    const winery = await db.$transaction(async (tx) => {
      // Create the winery with coordinates if available
      const newWinery = await tx.winery.create({
        data: {
          name,
          slug,
          description,
          address,
          commune,
          phone,
          email: user.email,
          userId: session.user.id,
          status: 'PENDING',
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
        },
      });

      // Update user role to WINEMAKER
      await tx.user.update({
        where: { id: session.user.id },
        data: { role: 'WINEMAKER' },
      });

      return newWinery;
    });

    // Track producer onboarding in PostHog (server-side)
    const posthogServer = getPostHogServer();
    if (posthogServer) {
      posthogServer.capture({
        distinctId: session.user.id,
        event: 'producer_onboarded',
        properties: {
          winery_id: winery.id,
          winery_slug: winery.slug,
          winery_name: name,
          commune,
        },
      });
      await posthogServer.flush();
    }

    return {
      success: true,
      data: { wineryId: winery.id, slug: winery.slug },
    };
  } catch (error) {
    logError('createWinery error', error, { action: 'createWinery' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}

/**
 * Update winery profile information
 */
export async function updateWineryProfile(
  input: WineryProfileInput
): Promise<ActionResult<{ updatedAt: Date }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // Validate input
    const validated = wineryProfileSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstError?.message ?? 'Invalid input',
        },
      };
    }

    // Get user's winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Check if winery is verified
    if (winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only verified wineries can update their profile',
        },
      };
    }

    // Check if address or commune changed - if so, re-geocode
    const addressChanged =
      (validated.data.address && validated.data.address !== winery.address) ||
      (validated.data.commune && validated.data.commune !== winery.commune);

    let coordinates: { latitude: number; longitude: number } | null = null;
    if (addressChanged) {
      try {
        const newAddress = validated.data.address ?? winery.address;
        const newCommune = validated.data.commune ?? winery.commune;
        coordinates = await geocodeWineryAddress(newAddress, newCommune);
      } catch (geocodeError) {
        logWarn('Geocoding failed for winery update', {
          action: 'updateWineryProfile',
          error: geocodeError,
        });
      }
    }

    // Update winery
    const updated = await db.winery.update({
      where: { id: winery.id },
      data: {
        ...validated.data,
        // Only update coordinates if address changed and we got new ones
        ...(addressChanged && {
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
        }),
      },
    });

    return {
      success: true,
      data: { updatedAt: updated.updatedAt },
    };
  } catch (error) {
    logError('updateWineryProfile error', error, {
      action: 'updateWineryProfile',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}

/**
 * Upload an image to Vercel Blob storage
 */
export async function uploadWineryImage(
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
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Image must be less than 5MB',
        },
      };
    }

    if (
      !WINERY_ALLOWED_TYPES.includes(
        file.type as (typeof WINERY_ALLOWED_TYPES)[number]
      )
    ) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only JPEG and PNG images are allowed',
        },
      };
    }

    // Upload to Vercel Blob
    const filename = `wineries/${session.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    });

    return {
      success: true,
      data: { url: blob.url },
    };
  } catch (error) {
    logError('uploadWineryImage error', error, { action: 'uploadWineryImage' });
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
 * Update winery cover photo
 */
export async function updateWineryCoverPhoto(
  coverPhotoUrl: string | null
): Promise<ActionResult<{ updatedAt: Date }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Delete old cover photo if exists and we're replacing
    if (winery.coverPhoto && coverPhotoUrl !== winery.coverPhoto) {
      try {
        await del(winery.coverPhoto);
      } catch {
        // Ignore deletion errors
      }
    }

    const updated = await db.winery.update({
      where: { id: winery.id },
      data: { coverPhoto: coverPhotoUrl },
    });

    return {
      success: true,
      data: { updatedAt: updated.updatedAt },
    };
  } catch (error) {
    logError('updateWineryCoverPhoto error', error, {
      action: 'updateWineryCoverPhoto',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}

/**
 * Add a gallery image
 */
export async function addGalleryImage(
  imageUrl: string
): Promise<ActionResult<{ id: string; order: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      include: { galleryImages: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Check max gallery images (6)
    if (winery.galleryImages.length >= 6) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Maximum 6 gallery images allowed',
        },
      };
    }

    // Get next order number
    const maxOrder = Math.max(
      0,
      ...winery.galleryImages.map((img) => img.order)
    );

    const image = await db.wineryGalleryImage.create({
      data: {
        url: imageUrl,
        order: maxOrder + 1,
        wineryId: winery.id,
      },
    });

    return {
      success: true,
      data: { id: image.id, order: image.order },
    };
  } catch (error) {
    logError('addGalleryImage error', error, { action: 'addGalleryImage' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}

/**
 * Remove a gallery image
 */
export async function removeGalleryImage(
  imageId: string
): Promise<ActionResult<{ removed: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    // Find the image
    const image = await db.wineryGalleryImage.findFirst({
      where: {
        id: imageId,
        wineryId: winery.id,
      },
    });

    if (!image) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Image not found' },
      };
    }

    // Delete from Blob storage
    try {
      await del(image.url);
    } catch {
      // Ignore deletion errors
    }

    // Delete from database
    await db.wineryGalleryImage.delete({
      where: { id: imageId },
    });

    return {
      success: true,
      data: { removed: true },
    };
  } catch (error) {
    logError('removeGalleryImage error', error, {
      action: 'removeGalleryImage',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}
