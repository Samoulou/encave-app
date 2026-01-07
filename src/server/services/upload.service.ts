import { put, del } from '@vercel/blob';

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
    console.error('Failed to delete image:', error);
  }
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'Image must be less than 5MB' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG and PNG images are allowed' };
  }

  return { valid: true };
}
