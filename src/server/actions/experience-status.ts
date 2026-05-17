'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { generateSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';
import {
  invalidateExperienceCaches,
  createExperienceSlugChecker,
} from './experience-helpers';
import { invalidateWineryCaches } from './winery-helpers';

/**
 * Publish an experience (DRAFT -> PUBLISHED)
 */
export async function publishExperience(
  experienceId: string
): Promise<ActionResult<{ status: string }>> {
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
      select: {
        id: true,
        status: true,
        stripeAccountId: true,
        stripeOnboardingComplete: true,
      },
    });

    if (!winery || winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      };
    }

    // Check Stripe onboarding status
    if (!winery.stripeAccountId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'Payment setup required. Connect your Stripe account to publish experiences.',
        },
      };
    }

    if (!winery.stripeOnboardingComplete) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'Complete your Stripe onboarding before publishing experiences.',
        },
      };
    }

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    if (experience.status !== 'DRAFT') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only draft experiences can be published',
        },
      };
    }

    // Get winery slug for cache invalidation
    const wineryData = await db.winery.findUnique({
      where: { id: winery.id },
      select: { slug: true },
    });

    await db.experience.update({
      where: { id: experienceId },
      data: { status: 'PUBLISHED' },
    });

    // Invalidate caches after publishing
    invalidateExperienceCaches(wineryData?.slug, experience.slug);
    // Publishing the first experience can flip the winery's public
    // visibility (criterion 6 of ENC-027).
    invalidateWineryCaches(wineryData?.slug);

    return {
      success: true,
      data: { status: 'PUBLISHED' },
    };
  } catch (error) {
    logError('publishExperience error', error, {
      action: 'publishExperience',
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
 * Unpublish an experience (PUBLISHED -> DRAFT)
 */
export async function unpublishExperience(
  experienceId: string
): Promise<ActionResult<{ status: string }>> {
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
      select: { id: true, status: true },
    });

    if (!winery || winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      };
    }

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    if (experience.status !== 'PUBLISHED') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only published experiences can be unpublished',
        },
      };
    }

    // Get winery slug for cache invalidation
    const wineryData = await db.winery.findUnique({
      where: { id: winery.id },
      select: { slug: true },
    });

    await db.experience.update({
      where: { id: experienceId },
      data: { status: 'DRAFT' },
    });

    // Invalidate caches after unpublishing
    invalidateExperienceCaches(wineryData?.slug, experience.slug);
    // Unpublishing the last published experience flips the winery
    // off visibility (criterion 6 of ENC-027).
    invalidateWineryCaches(wineryData?.slug);

    return {
      success: true,
      data: { status: 'DRAFT' },
    };
  } catch (error) {
    logError('unpublishExperience error', error, {
      action: 'unpublishExperience',
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
 * Archive an experience (any status -> ARCHIVED)
 */
export async function archiveExperience(
  experienceId: string
): Promise<ActionResult<{ status: string }>> {
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
      select: { id: true, status: true },
    });

    if (!winery || winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      };
    }

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    if (experience.status === 'ARCHIVED') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Experience is already archived',
        },
      };
    }

    // Get winery slug for cache invalidation
    const wineryData = await db.winery.findUnique({
      where: { id: winery.id },
      select: { slug: true },
    });

    await db.experience.update({
      where: { id: experienceId },
      data: { status: 'ARCHIVED' },
    });

    // Invalidate caches after archiving
    invalidateExperienceCaches(wineryData?.slug, experience.slug);
    // Archiving the last published experience flips the winery off
    // visibility (criterion 6 of ENC-027).
    invalidateWineryCaches(wineryData?.slug);

    return {
      success: true,
      data: { status: 'ARCHIVED' },
    };
  } catch (error) {
    logError('archiveExperience error', error, {
      action: 'archiveExperience',
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
 * Duplicate an experience (creates copy with DRAFT status)
 */
export async function duplicateExperience(
  experienceId: string
): Promise<ActionResult<{ experienceId: string; slug: string }>> {
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
      select: { id: true, status: true },
    });

    if (!winery || winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      };
    }

    const experience = await db.experience.findFirst({
      where: { id: experienceId, wineryId: winery.id },
      include: {
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

    // Generate new unique slug
    const baseSlug = generateSlug(`${experience.title} copy`);
    const slug = await ensureUniqueSlug(
      baseSlug,
      createExperienceSlugChecker(winery.id)
    );

    // Get winery slug for cache invalidation
    const wineryData = await db.winery.findUnique({
      where: { id: winery.id },
      select: { slug: true },
    });

    // Create duplicate in transaction
    const duplicate = await db.$transaction(async (tx) => {
      const newExperience = await tx.experience.create({
        data: {
          wineryId: winery.id,
          title: `${experience.title} (Copy)`,
          slug,
          description: experience.description,
          type: experience.type,
          duration: experience.duration,
          price: experience.price,
          minCapacity: experience.minCapacity,
          maxCapacity: experience.maxCapacity,
          coverPhoto: experience.coverPhoto,
          status: 'DRAFT',
        },
      });

      // Copy gallery images
      if (experience.galleryImages.length > 0) {
        await tx.experienceGalleryImage.createMany({
          data: experience.galleryImages.map((img, index) => ({
            experienceId: newExperience.id,
            url: img.url,
            order: index,
          })),
        });
      }

      // Copy availability slots (AC8)
      if (experience.availabilitySlots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: experience.availabilitySlots.map((slot) => ({
            experienceId: newExperience.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isActive: slot.isActive,
          })),
        });
      }

      return newExperience;
    });

    // Invalidate caches after duplication
    invalidateExperienceCaches(wineryData?.slug, duplicate.slug);

    return {
      success: true,
      data: { experienceId: duplicate.id, slug: duplicate.slug },
    };
  } catch (error) {
    logError('duplicateExperience error', error, {
      action: 'duplicateExperience',
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
