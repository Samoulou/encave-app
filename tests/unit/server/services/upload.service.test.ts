import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Vercel Blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// Mock image validator
vi.mock('@/lib/validators/image', () => ({
  validateImageFile: vi.fn(),
  WINERY_ALLOWED_TYPES: ['image/jpeg', 'image/png'],
}));

import { put, del } from '@vercel/blob';
import { validateImageFile as sharedValidateImageFile } from '@/lib/validators/image';
import {
  uploadImage,
  deleteImage,
  validateImageFile,
} from '@/server/services/upload.service';

const mockPut = vi.mocked(put);
const mockDel = vi.mocked(del);
const mockSharedValidate = vi.mocked(sharedValidateImageFile);

describe('Upload Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockFile(name: string, size: number, type: string): File {
    const buffer = new ArrayBuffer(size);
    const blob = new Blob([buffer], { type });
    return new File([blob], name, { type });
  }

  // ========================================
  // uploadImage
  // ========================================
  describe('uploadImage', () => {
    it('uploads a file and returns the URL', async () => {
      const file = createMockFile('photo.jpg', 1024, 'image/jpeg');
      const blobUrl = 'https://blob.vercel-storage.com/wineries/photo.jpg';

      mockPut.mockResolvedValueOnce({
        url: blobUrl,
        pathname: 'wineries/photo.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'attachment',
        downloadUrl: blobUrl,
      });

      const result = await uploadImage(file);

      expect(result.url).toBe(blobUrl);
      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('wineries/'),
        file,
        { access: 'public', contentType: 'image/jpeg' }
      );
    });

    it('defaults to wineries folder when no folder specified', async () => {
      const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

      mockPut.mockResolvedValueOnce({
        url: 'https://blob.vercel-storage.com/wineries/photo.jpg',
        pathname: 'wineries/photo.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'attachment',
        downloadUrl: 'https://blob.vercel-storage.com/wineries/photo.jpg',
      });

      await uploadImage(file);

      const calledPath = mockPut.mock.calls[0][0] as string;
      expect(calledPath).toMatch(/^wineries\//);
    });

    it('uses custom folder in filename', async () => {
      const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

      mockPut.mockResolvedValueOnce({
        url: 'https://blob.vercel-storage.com/custom/photo.jpg',
        pathname: 'custom/photo.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'attachment',
        downloadUrl: 'https://blob.vercel-storage.com/custom/photo.jpg',
      });

      await uploadImage(file, 'custom');

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('custom/'),
        file,
        expect.any(Object)
      );
    });

    it('includes a timestamp in the filename', async () => {
      const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

      mockPut.mockResolvedValueOnce({
        url: 'https://blob.vercel-storage.com/wineries/photo.jpg',
        pathname: 'wineries/photo.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'attachment',
        downloadUrl: 'https://blob.vercel-storage.com/wineries/photo.jpg',
      });

      await uploadImage(file);

      const calledPath = mockPut.mock.calls[0][0] as string;
      // Pattern: folder/timestamp-filename
      expect(calledPath).toMatch(/^wineries\/\d+-photo\.jpg$/);
    });

    it('sanitizes filename for special characters', async () => {
      const file = createMockFile('my photo (1).jpg', 1024, 'image/jpeg');

      mockPut.mockResolvedValueOnce({
        url: 'https://blob.vercel-storage.com/test.jpg',
        pathname: 'test.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'attachment',
        downloadUrl: 'https://blob.vercel-storage.com/test.jpg',
      });

      await uploadImage(file);

      const calledPath = mockPut.mock.calls[0][0] as string;
      expect(calledPath).not.toContain(' ');
      expect(calledPath).not.toContain('(');
      expect(calledPath).not.toContain(')');
    });

    it('passes content type from the file to blob storage', async () => {
      const file = createMockFile('photo.png', 1024, 'image/png');

      mockPut.mockResolvedValueOnce({
        url: 'https://blob.vercel-storage.com/wineries/photo.png',
        pathname: 'wineries/photo.png',
        contentType: 'image/png',
        contentDisposition: 'attachment',
        downloadUrl: 'https://blob.vercel-storage.com/wineries/photo.png',
      });

      await uploadImage(file);

      expect(mockPut).toHaveBeenCalledWith(expect.any(String), file, {
        access: 'public',
        contentType: 'image/png',
      });
    });

    it('sets access to public', async () => {
      const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

      mockPut.mockResolvedValueOnce({
        url: 'https://blob.vercel-storage.com/wineries/photo.jpg',
        pathname: 'wineries/photo.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'attachment',
        downloadUrl: 'https://blob.vercel-storage.com/wineries/photo.jpg',
      });

      await uploadImage(file);

      expect(mockPut).toHaveBeenCalledWith(
        expect.any(String),
        file,
        expect.objectContaining({ access: 'public' })
      );
    });

    it('propagates Vercel Blob errors', async () => {
      const file = createMockFile('photo.jpg', 1024, 'image/jpeg');
      mockPut.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(uploadImage(file)).rejects.toThrow('Upload failed');
    });
  });

  // ========================================
  // deleteImage
  // ========================================
  describe('deleteImage', () => {
    it('deletes image from blob storage', async () => {
      mockDel.mockResolvedValueOnce(undefined);

      await deleteImage('https://blob.vercel-storage.com/photo.jpg');

      expect(mockDel).toHaveBeenCalledWith(
        'https://blob.vercel-storage.com/photo.jpg'
      );
    });

    it('does not throw when deletion fails', async () => {
      mockDel.mockRejectedValueOnce(new Error('Not found'));

      await expect(
        deleteImage('https://blob.vercel-storage.com/missing.jpg')
      ).resolves.toBeUndefined();
    });

    it('logs error when deletion fails', async () => {
      const { logError } = await import('@/lib/logger');
      mockDel.mockRejectedValueOnce(new Error('Delete error'));

      await deleteImage('https://blob.vercel-storage.com/photo.jpg');

      expect(logError).toHaveBeenCalledWith(
        'Failed to delete image',
        expect.any(Error),
        { action: 'deleteImage' }
      );
    });
  });

  // ========================================
  // validateImageFile (deprecated wrapper)
  // ========================================
  describe('validateImageFile', () => {
    it('delegates to shared validator with winery types', () => {
      mockSharedValidate.mockReturnValueOnce({ valid: true });
      const file = createMockFile('photo.jpg', 1024, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
      expect(mockSharedValidate).toHaveBeenCalledWith(file, [
        'image/jpeg',
        'image/png',
      ]);
    });

    it('returns error from shared validator', () => {
      mockSharedValidate.mockReturnValueOnce({
        valid: false,
        error: 'Image must be less than 5MB',
      });
      const file = createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('5MB');
    });
  });
});
