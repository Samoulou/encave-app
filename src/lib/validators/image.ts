import { z } from 'zod';

/**
 * Image validation constants
 */
export const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
export const WINERY_ALLOWED_TYPES = ['image/jpeg', 'image/png'] as const;
export const EXPERIENCE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Create an image file validation schema with configurable allowed types
 */
export function createImageFileSchema(
  allowedTypes: readonly string[] = WINERY_ALLOWED_TYPES
) {
  const typeMessage =
    allowedTypes.length === 2
      ? 'Only JPEG and PNG images are allowed'
      : 'Only JPEG, PNG, and WebP images are allowed';

  return z
    .instanceof(File)
    .refine((f) => f.size <= IMAGE_MAX_SIZE, 'Image must be less than 5MB')
    .refine((f) => allowedTypes.includes(f.type), typeMessage);
}

/**
 * Image file validation schema for wineries (JPEG and PNG only)
 */
export const wineryImageSchema = createImageFileSchema(WINERY_ALLOWED_TYPES);

/**
 * Image file validation schema for experiences (JPEG, PNG, and WebP)
 */
export const experienceImageSchema = createImageFileSchema(EXPERIENCE_ALLOWED_TYPES);

export type WineryImageFile = z.infer<typeof wineryImageSchema>;
export type ExperienceImageFile = z.infer<typeof experienceImageSchema>;

/**
 * Validate image file (imperative version for server-side use)
 */
export function validateImageFile(
  file: File,
  allowedTypes: readonly string[] = WINERY_ALLOWED_TYPES
): { valid: boolean; error?: string } {
  if (file.size > IMAGE_MAX_SIZE) {
    return { valid: false, error: 'Image must be less than 5MB' };
  }

  if (!allowedTypes.includes(file.type)) {
    const typeMessage =
      allowedTypes.length === 2
        ? 'Only JPEG and PNG images are allowed'
        : 'Only JPEG, PNG, and WebP images are allowed';
    return { valid: false, error: typeMessage };
  }

  return { valid: true };
}
