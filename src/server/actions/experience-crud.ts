'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  createExperienceSchema,
  type CreateExperienceInput,
} from '@/lib/validators/experience';
import { generateSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import { activeCapacityBookingWhere } from '@/lib/business-rules/capacity';
import {
  experienceBlobPrefix,
  isLocalImagePath,
  isOwnedBlobUrl,
} from '@/lib/utils/blob-ownership';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';
import {
  invalidateExperienceCaches,
  createExperienceSlugChecker,
} from './experience-helpers';

/** Max gallery images persisted per experience (AC 8). */
const MAX_GALLERY_IMAGES = 8;

/**
 * SECURITY (pre-launch audit): cover + gallery URLs come straight from the
 * client and end up in the public fiche (`<Image>`, JSON-LD) and in emails.
 * An arbitrary URL there is a tracking pixel / content-injection vector, so
 * only three kinds of value are accepted:
 *  - a blob THIS winery uploaded (uploadExperienceImage →
 *    `experiences/{wineryId}/…`);
 *  - a same-origin `/images/…` static asset (seed / demo covers);
 *  - on update, a value ALREADY stored on that experience (legacy rows —
 *    e.g. seeded Unsplash covers — stay editable without a re-upload).
 * Returns the validated lists, or null when any URL is refused.
 */
function validateExperienceImages(
  wineryId: string,
  coverPhotoUrl: unknown,
  galleryImageUrls: unknown,
  alreadyStored: ReadonlySet<string> = new Set()
): { cover: string; gallery: string[] } | null {
  const ownerPrefix = experienceBlobPrefix(wineryId);
  const isAllowed = (url: unknown): url is string =>
    typeof url === 'string' &&
    (alreadyStored.has(url) ||
      isOwnedBlobUrl(url, ownerPrefix) ||
      isLocalImagePath(url));

  if (!isAllowed(coverPhotoUrl)) return null;
  if (!Array.isArray(galleryImageUrls)) return null;
  const gallery: string[] = [];
  for (const url of galleryImageUrls.slice(0, MAX_GALLERY_IMAGES)) {
    if (!isAllowed(url)) return null;
    gallery.push(url);
  }
  return { cover: coverPhotoUrl, gallery };
}

const INVALID_IMAGE_ERROR: ActionResult<never> = {
  success: false,
  error: { code: 'VALIDATION_ERROR', message: 'Invalid image URL' },
};

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

    const {
      title,
      type,
      description,
      duration,
      price,
      minCapacity,
      maxCapacity,
      paymentMode,
      isCollective,
      languages,
      location,
      availabilitySlots,
    } = validated.data;

    // Cover + gallery must be this winery's own uploads (or local assets).
    const images = validateExperienceImages(
      winery.id,
      coverPhotoUrl,
      galleryImageUrls
    );
    if (!images) return INVALID_IMAGE_ERROR;

    // 4. Generate a globally unique slug (the fiche URL has no winery segment)
    const baseSlug = generateSlug(title);
    const slug = await ensureUniqueSlug(
      baseSlug,
      createExperienceSlugChecker()
    );

    // 5. Convert price to cents for storage
    const priceInCents = Math.round(price * 100);

    // 6. Create experience with DRAFT status (AC 10)
    // Get winery slug for cache invalidation
    const wineryData = await db.winery.findUnique({
      where: { id: winery.id },
      select: { slug: true },
    });

    // Helper to convert day string to number (0 = Sunday, 6 = Saturday)
    const dayToNumber = (day: string): number => {
      const days: Record<string, number> = {
        SUN: 0,
        MON: 1,
        TUE: 2,
        WED: 3,
        THU: 4,
        FRI: 5,
        SAT: 6,
      };
      return days[day] ?? 0;
    };

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
          paymentMode,
          // P-11 (L-100): additive — undefined keeps the @default(false).
          ...(isCollective !== undefined && { isCollective }),
          // P-02 (L-115): additive — undefined keeps the @default([FR]).
          ...(languages !== undefined && { languages }),
          coverPhoto: images.cover,
          status: 'DRAFT',
          // Location fields
          address: location?.street || null,
          city: location?.city || null,
          zipCode: location?.zipCode || null,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
        },
      });

      // Add gallery images if provided (AC 8)
      if (images.gallery.length > 0) {
        await tx.experienceGalleryImage.createMany({
          data: images.gallery.map((url, index) => ({
            experienceId: newExperience.id,
            url,
            order: index,
          })),
        });
      }

      // Add availability slots if provided
      if (availabilitySlots && availabilitySlots.length > 0) {
        const slotsToCreate: {
          experienceId: string;
          dayOfWeek: number;
          startTime: string;
          endTime: string;
          isActive: boolean;
        }[] = [];

        for (const slot of availabilitySlots) {
          for (const day of slot.days) {
            for (const timeSlot of slot.timeSlots) {
              slotsToCreate.push({
                experienceId: newExperience.id,
                dayOfWeek: dayToNumber(day),
                startTime: timeSlot.start,
                endTime: timeSlot.end,
                isActive: true,
              });
            }
          }
        }

        if (slotsToCreate.length > 0) {
          await tx.availabilitySlot.createMany({
            data: slotsToCreate,
          });
        }
      }

      return newExperience;
    });

    // Invalidate caches after successful creation
    invalidateExperienceCaches(wineryData?.slug, experience.slug);

    return {
      success: true,
      data: { experienceId: experience.id, slug: experience.slug },
    };
  } catch (error) {
    logError('createExperience error', error, { action: 'createExperience' });
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
 * Update an existing experience
 */
export async function updateExperience(
  experienceId: string,
  input: CreateExperienceInput,
  coverPhotoUrl: string,
  galleryImageUrls: string[] = []
): Promise<ActionResult<{ experienceId: string; slug: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // Validate input
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

    // Get user's winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!winery || winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      };
    }

    // Verify experience belongs to this winery
    const existingExperience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
      include: { galleryImages: true },
    });

    if (!existingExperience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    // Cover + gallery: this winery's own uploads, local assets, or values
    // this experience already holds (legacy rows stay editable).
    const images = validateExperienceImages(
      winery.id,
      coverPhotoUrl,
      galleryImageUrls,
      new Set([
        existingExperience.coverPhoto,
        ...existingExperience.galleryImages.map((image) => image.url),
      ])
    );
    if (!images) return INVALID_IMAGE_ERROR;

    const {
      title,
      type,
      description,
      duration,
      price,
      minCapacity,
      maxCapacity,
      paymentMode,
      isCollective,
      languages,
    } = validated.data;

    // Generate new slug if title changed
    let slug = existingExperience.slug;
    if (title !== existingExperience.title) {
      const baseSlug = generateSlug(title);
      slug = await ensureUniqueSlug(
        baseSlug,
        createExperienceSlugChecker(existingExperience.id)
      );
    }

    // Convert price to cents
    const priceInCents = Math.round(price * 100);

    // Get winery slug for cache invalidation
    const wineryData = await db.winery.findUnique({
      where: { id: winery.id },
      select: { slug: true },
    });

    // Update experience in transaction
    const experience = await db.$transaction(async (tx) => {
      // Delete old gallery images
      await tx.experienceGalleryImage.deleteMany({
        where: { experienceId },
      });

      // Update experience
      const updated = await tx.experience.update({
        where: { id: experienceId },
        data: {
          title,
          slug,
          description,
          type,
          duration,
          price: priceInCents,
          minCapacity,
          maxCapacity,
          paymentMode,
          // P-11 (L-100): additive — undefined leaves the stored flag untouched.
          ...(isCollective !== undefined && { isCollective }),
          // P-02 (L-115): additive — undefined leaves stored languages untouched.
          ...(languages !== undefined && { languages }),
          coverPhoto: images.cover,
        },
      });

      // Add new gallery images
      if (images.gallery.length > 0) {
        await tx.experienceGalleryImage.createMany({
          data: images.gallery.map((url, index) => ({
            experienceId,
            url,
            order: index,
          })),
        });
      }

      return updated;
    });

    // Invalidate caches after successful update
    // Also invalidate old slug if it changed
    invalidateExperienceCaches(wineryData?.slug, experience.slug);
    if (existingExperience.slug !== experience.slug) {
      invalidateExperienceCaches(undefined, existingExperience.slug);
    }

    return {
      success: true,
      data: { experienceId: experience.id, slug: experience.slug },
    };
  } catch (error) {
    logError('updateExperience error', error, {
      action: 'updateExperience',
      experienceId,
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
 * Delete an experience permanently
 */
export async function deleteExperience(
  experienceId: string
): Promise<ActionResult<{ deleted: boolean }>> {
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
      select: { id: true, status: true, slug: true },
    });

    if (!winery || winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      };
    }

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
      select: {
        id: true,
        slug: true,
        _count: {
          select: {
            bookings: {
              // Same rule as capacity (P-04): an expired hold/pending row
              // is logically released and must not block deletion.
              where: activeCapacityBookingWhere(),
            },
          },
        },
      },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    // Prevent deletion if there are active bookings
    if (experience._count.bookings > 0) {
      return {
        success: false,
        error: {
          // Dedicated code: the UI shows translated guidance ("archive it
          // instead") rather than a generic validation message.
          code: 'HAS_BOOKINGS',
          message:
            'Cannot delete experience with active bookings. Archive it instead.',
        },
      };
    }

    // Delete the experience (cascade will handle related records)
    await db.experience.delete({
      where: { id: experienceId },
    });

    // Invalidate caches
    invalidateExperienceCaches(winery.slug, experience.slug);

    return {
      success: true,
      data: { deleted: true },
    };
  } catch (error) {
    logError('deleteExperience error', error, {
      action: 'deleteExperience',
      experienceId,
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
