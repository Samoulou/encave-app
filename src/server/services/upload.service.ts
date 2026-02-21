import { put, del } from '@vercel/blob';
import { logError } from '@/lib/logger';
import {
  validateImageFile as sharedValidateImageFile,
  WINERY_ALLOWED_TYPES,
} from '@/lib/validators/image';

/**
 * Upload a file to Vercel Blob storage
 */
export async function uploadImage(
  file: File,
  folder: string = 'wineries'
): Promise<{ url: string }> {
  const filename = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  const blob = await put(filename, file, {
    access: 'public',
    contentType: file.type,
  });

  return { url: blob.url };
}

/**
 * Delete a file from Vercel Blob storage
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    // Log but don't throw - image might already be deleted
    logError('Failed to delete image', error, { action: 'deleteImage' });
  }
}

/**
 * Validate image file before upload
 * @deprecated Use validateImageFile from '@/lib/validators/image' instead
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  return sharedValidateImageFile(file, WINERY_ALLOWED_TYPES);
}
