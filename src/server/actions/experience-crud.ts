'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  createExperienceSchema,
  type CreateExperienceInput,
} from '@/lib/validators/experience';
import { generateSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import { activeCapacityBookingWhere } from '@/lib/business-rules/capacity';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';
import {
  invalidateExperienceCaches,
  createExperienceSlugChecker,
} from './experience-helpers';

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
      location,
      availabilitySlots,
    } = validated.data;

    // 4. Generate unique slug within winery (AC 9)
    const baseSlug = generateSlug(title);
    const slug = await ensureUniqueSlug(
      baseSlug,
      createExperienceSlugChecker(winery.id)
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
          coverPhoto: coverPhotoUrl,
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
      if (galleryImageUrls.length > 0) {
        await tx.experienceGalleryImage.createMany({
          data: galleryImageUrls.slice(0, 8).map((url, index) => ({
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

    const {
      title,
      type,
      description,
      duration,
      price,
      minCapacity,
      maxCapacity,
    } = validated.data;

    // Generate new slug if title changed
    let slug = existingExperience.slug;
    if (title !== existingExperience.title) {
      const baseSlug = generateSlug(title);
      slug = await ensureUniqueSlug(
        baseSlug,
        createExperienceSlugChecker(winery.id)
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
          coverPhoto: coverPhotoUrl,
        },
      });

      // Add new gallery images
      if (galleryImageUrls.length > 0) {
        await tx.experienceGalleryImage.createMany({
          data: galleryImageUrls.slice(0, 8).map((url, index) => ({
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
          code: 'VALIDATION_ERROR',
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

/**
 * Get a single experience for editing
 */
export async function getExperienceForEdit(experienceId: string): Promise<
  ActionResult<{
    id: string;
    title: string;
    type: string;
    description: string;
    duration: number;
    price: number;
    minCapacity: number;
    maxCapacity: number;
    coverPhoto: string;
    galleryImages: { id: string; url: string; order: number }[];
  }>
> {
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
      select: { id: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
      include: { galleryImages: { orderBy: { order: 'asc' } } },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    return {
      success: true,
      data: {
        id: experience.id,
        title: experience.title,
        type: experience.type,
        description: experience.description,
        duration: experience.duration,
        price: experience.price / 100, // Convert cents to CHF
        minCapacity: experience.minCapacity,
        maxCapacity: experience.maxCapacity,
        coverPhoto: experience.coverPhoto,
        galleryImages: experience.galleryImages.map((img) => ({
          id: img.id,
          url: img.url,
          order: img.order,
        })),
      },
    };
  } catch (error) {
    logError('getExperienceForEdit error', error, {
      action: 'getExperienceForEdit',
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
 * Get an experience for preview (owner only, any status)
 */
export async function getExperienceForPreview(experienceId: string): Promise<
  ActionResult<{
    id: string;
    title: string;
    slug: string;
    type: string;
    description: string;
    duration: number;
    price: number;
    minCapacity: number;
    maxCapacity: number;
    coverPhoto: string;
    status: string;
    galleryImages: { id: string; url: string; order: number }[];
    availabilitySlots: {
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isActive: boolean;
    }[];
    winery: {
      id: string;
      name: string;
      slug: string;
      commune: string;
      address: string;
      coverPhoto: string | null;
      latitude: number | null;
      longitude: number | null;
      stripeOnboardingComplete: boolean;
    };
  }>
> {
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
      select: { id: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
      include: {
        winery: {
          select: {
            id: true,
            name: true,
            slug: true,
            commune: true,
            address: true,
            coverPhoto: true,
            latitude: true,
            longitude: true,
            stripeOnboardingComplete: true,
          },
        },
        galleryImages: { orderBy: { order: 'asc' } },
        availabilitySlots: { orderBy: { dayOfWeek: 'asc' } },
      },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    return {
      success: true,
      data: {
        id: experience.id,
        title: experience.title,
        slug: experience.slug,
        type: experience.type,
        description: experience.description,
        duration: experience.duration,
        price: experience.price,
        minCapacity: experience.minCapacity,
        maxCapacity: experience.maxCapacity,
        coverPhoto: experience.coverPhoto,
        status: experience.status,
        galleryImages: experience.galleryImages.map((img) => ({
          id: img.id,
          url: img.url,
          order: img.order,
        })),
        availabilitySlots: experience.availabilitySlots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive,
        })),
        winery: experience.winery,
      },
    };
  } catch (error) {
    logError('getExperienceForPreview error', error, {
      action: 'getExperienceForPreview',
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
