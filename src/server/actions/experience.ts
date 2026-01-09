'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { put, del } from '@vercel/blob';
import {
  createExperienceSchema,
  type CreateExperienceInput,
} from '@/lib/validators/experience';
import { generateSlug } from '@/lib/utils/slug';
import type { ActionResult } from '@/types/actions';

/**
 * Ensure slug uniqueness within a winery by appending a number if needed
 */
async function ensureUniqueExperienceSlug(
  wineryId: string,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.experience.findUnique({
      where: {
        wineryId_slug: { wineryId, slug },
      },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    // Safety limit to prevent infinite loops
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      return slug;
    }
  }
}

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
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    if (file.size > MAX_SIZE) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Image must be less than 5MB' },
      };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
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
    console.error('uploadExperienceImage error:', error);
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
 * Create a new experience for the current user's winery
 * Experience is created with DRAFT status per AC 10
 */
export async function createExperience(
  input: CreateExperienceInput,
  coverPhotoUrl: string,
  galleryImageUrls: string[] = []
): Promise<ActionResult<{ experienceId: string; slug: string }>> {
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
    const validated = createExperienceSchema.safeParse(input);
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

    // 3. Get user's verified winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    if (winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only verified winemakers can create experiences',
        },
      };
    }

    const { title, type, description, duration, price, minCapacity, maxCapacity } =
      validated.data;

    // 4. Generate unique slug within winery (AC 9)
    const baseSlug = generateSlug(title);
    const slug = await ensureUniqueExperienceSlug(winery.id, baseSlug);

    // 5. Convert price to cents for storage
    const priceInCents = Math.round(price * 100);

    // 6. Create experience with DRAFT status (AC 10)
    const experience = await db.$transaction(async (tx) => {
      const newExperience = await tx.experience.create({
        data: {
          wineryId: winery.id,
          title,
          slug,
          description,
          type,
          duration,
          price: priceInCents,
          minCapacity,
          maxCapacity,
          coverPhoto: coverPhotoUrl,
          status: 'DRAFT',
        },
      });

      // Add gallery images if provided (AC 8)
      if (galleryImageUrls.length > 0) {
        await tx.experienceGalleryImage.createMany({
          data: galleryImageUrls.slice(0, 8).map((url, index) => ({
            experienceId: newExperience.id,
            url,
            order: index,
          })),
        });
      }

      return newExperience;
    });

    return {
      success: true,
      data: { experienceId: experience.id, slug: experience.slug },
    };
  } catch (error) {
    console.error('createExperience error:', error);
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
    console.error('deleteUploadedImage error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}
