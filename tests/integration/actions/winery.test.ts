import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Session } from 'next-auth';

// Mock next-auth
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    wineryGalleryImage: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock Vercel Blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { put, del } from '@vercel/blob';
import {
  updateWineryProfile,
  uploadWineryImage,
  updateWineryCoverPhoto,
  addGalleryImage,
  removeGalleryImage,
} from '@/server/actions/winery';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);
const mockPut = vi.mocked(put);
const mockDel = vi.mocked(del);

describe('Winery Profile Actions Integration Tests', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'winemaker@test.com',
      role: 'WINEMAKER',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };

  const mockWinery = {
    id: 'winery-123',
    userId: 'user-123',
    name: 'Test Winery',
    slug: 'test-winery',
    description:
      'A beautiful winery in the heart of Valais with exceptional wines.',
    address: 'Rue du Vignoble 12',
    commune: 'Sion',
    phone: '+41 27 123 45 67',
    email: 'winemaker@test.com',
    status: 'VERIFIED' as const,
    coverPhoto: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    galleryImages: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('updateWineryProfile', () => {
    const validProfileInput = {
      description:
        'Updated description with more than fifty characters for validation.',
      address: 'New Address 123',
      commune: 'Sierre',
      phone: '+41 27 987 65 43',
    };

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await updateWineryProfile(validProfileInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when user has no winery', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await updateWineryProfile(validProfileInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when winery is not verified', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        ...mockWinery,
        status: 'PENDING',
      });

      const result = await updateWineryProfile(validProfileInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
        expect(result.error.message).toContain('verified');
      }
    });

    it('returns VALIDATION_ERROR for invalid input', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery);

      const result = await updateWineryProfile({
        ...validProfileInput,
        description: 'Too short',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('successfully updates profile for verified winery', async () => {
      const updatedAt = new Date();
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery);
      mockDb.winery.update.mockResolvedValueOnce({
        ...mockWinery,
        ...validProfileInput,
        updatedAt,
      });

      const result = await updateWineryProfile(validProfileInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedAt).toEqual(updatedAt);
      }
      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { id: mockWinery.id },
        data: expect.objectContaining(validProfileInput),
      });
    });
  });

  describe('uploadWineryImage', () => {
    function createMockFile(name: string, size: number, type: string): File {
      const buffer = new ArrayBuffer(size);
      const blob = new Blob([buffer], { type });
      return new File([blob], name, { type });
    }

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);
      const formData = new FormData();

      const result = await uploadWineryImage(formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns VALIDATION_ERROR when no file provided', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      const formData = new FormData();

      const result = await uploadWineryImage(formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('No file');
      }
    });

    it('returns VALIDATION_ERROR for file exceeding 5MB', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      const formData = new FormData();
      const largeFile = createMockFile(
        'large.jpg',
        6 * 1024 * 1024,
        'image/jpeg'
      );
      formData.append('file', largeFile);

      const result = await uploadWineryImage(formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('5MB');
      }
    });

    it('returns VALIDATION_ERROR for non-JPEG/PNG files', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      const formData = new FormData();
      const gifFile = createMockFile('image.gif', 1024, 'image/gif');
      formData.append('file', gifFile);

      const result = await uploadWineryImage(formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('JPEG and PNG');
      }
    });

    it('successfully uploads valid JPEG image', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      const formData = new FormData();
      const jpegFile = createMockFile('photo.jpg', 1024, 'image/jpeg');
      formData.append('file', jpegFile);

      const blobUrl = 'https://blob.vercel-storage.com/test-image.jpg';
      mockPut.mockResolvedValueOnce({
        url: blobUrl,
        pathname: 'test-image.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'attachment',
        downloadUrl: blobUrl,
      });

      const result = await uploadWineryImage(formData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(blobUrl);
      }
      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('wineries/user-123/'),
        expect.any(File),
        expect.objectContaining({
          access: 'public',
          contentType: 'image/jpeg',
        })
      );
    });

    it('successfully uploads valid PNG image', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      const formData = new FormData();
      const pngFile = createMockFile('photo.png', 1024, 'image/png');
      formData.append('file', pngFile);

      const blobUrl = 'https://blob.vercel-storage.com/test-image.png';
      mockPut.mockResolvedValueOnce({
        url: blobUrl,
        pathname: 'test-image.png',
        contentType: 'image/png',
        contentDisposition: 'attachment',
        downloadUrl: blobUrl,
      });

      const result = await uploadWineryImage(formData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(blobUrl);
      }
    });
  });

  describe('updateWineryCoverPhoto', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await updateWineryCoverPhoto(
        'https://example.com/photo.jpg'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery does not exist', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await updateWineryCoverPhoto(
        'https://example.com/photo.jpg'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('successfully sets cover photo', async () => {
      const updatedAt = new Date();
      const newCoverUrl = 'https://blob.vercel-storage.com/new-cover.jpg';

      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery);
      mockDb.winery.update.mockResolvedValueOnce({
        ...mockWinery,
        coverPhoto: newCoverUrl,
        updatedAt,
      });

      const result = await updateWineryCoverPhoto(newCoverUrl);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedAt).toEqual(updatedAt);
      }
      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { id: mockWinery.id },
        data: { coverPhoto: newCoverUrl },
      });
    });

    it('deletes old cover photo when replacing', async () => {
      const oldCoverUrl = 'https://blob.vercel-storage.com/old-cover.jpg';
      const newCoverUrl = 'https://blob.vercel-storage.com/new-cover.jpg';

      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        ...mockWinery,
        coverPhoto: oldCoverUrl,
      });
      mockDb.winery.update.mockResolvedValueOnce({
        ...mockWinery,
        coverPhoto: newCoverUrl,
        updatedAt: new Date(),
      });
      mockDel.mockResolvedValueOnce(undefined);

      const result = await updateWineryCoverPhoto(newCoverUrl);

      expect(result.success).toBe(true);
      expect(mockDel).toHaveBeenCalledWith(oldCoverUrl);
    });

    it('allows removing cover photo by passing null', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery);
      mockDb.winery.update.mockResolvedValueOnce({
        ...mockWinery,
        coverPhoto: null,
        updatedAt: new Date(),
      });

      const result = await updateWineryCoverPhoto(null);

      expect(result.success).toBe(true);
      expect(mockDb.winery.update).toHaveBeenCalledWith({
        where: { id: mockWinery.id },
        data: { coverPhoto: null },
      });
    });
  });

  describe('addGalleryImage', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await addGalleryImage('https://example.com/photo.jpg');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery does not exist', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await addGalleryImage('https://example.com/photo.jpg');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR when gallery is full (6 images)', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        ...mockWinery,
        galleryImages: Array(6).fill({ id: 'img', url: 'url', order: 1 }),
      });

      const result = await addGalleryImage('https://example.com/photo.jpg');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Maximum 6');
      }
    });

    it('successfully adds gallery image with correct order', async () => {
      const existingImages = [
        { id: 'img-1', url: 'url1', order: 1 },
        { id: 'img-2', url: 'url2', order: 2 },
      ];
      const newImageUrl = 'https://blob.vercel-storage.com/gallery.jpg';

      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        ...mockWinery,
        galleryImages: existingImages,
      });
      mockDb.wineryGalleryImage.create.mockResolvedValueOnce({
        id: 'img-3',
        url: newImageUrl,
        order: 3,
        wineryId: mockWinery.id,
        createdAt: new Date(),
      });

      const result = await addGalleryImage(newImageUrl);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('img-3');
        expect(result.data.order).toBe(3);
      }
      expect(mockDb.wineryGalleryImage.create).toHaveBeenCalledWith({
        data: {
          url: newImageUrl,
          order: 3,
          wineryId: mockWinery.id,
        },
      });
    });
  });

  describe('removeGalleryImage', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await removeGalleryImage('img-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery does not exist', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await removeGalleryImage('img-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns NOT_FOUND when image does not exist', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery);
      mockDb.wineryGalleryImage.findFirst.mockResolvedValueOnce(null);

      const result = await removeGalleryImage('non-existent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('Image not found');
      }
    });

    it('successfully removes gallery image and deletes from blob', async () => {
      const imageToRemove = {
        id: 'img-123',
        url: 'https://blob.vercel-storage.com/gallery.jpg',
        order: 1,
        wineryId: mockWinery.id,
        createdAt: new Date(),
      };

      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery);
      mockDb.wineryGalleryImage.findFirst.mockResolvedValueOnce(imageToRemove);
      mockDel.mockResolvedValueOnce(undefined);
      mockDb.wineryGalleryImage.delete.mockResolvedValueOnce(imageToRemove);

      const result = await removeGalleryImage('img-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.removed).toBe(true);
      }
      expect(mockDel).toHaveBeenCalledWith(imageToRemove.url);
      expect(mockDb.wineryGalleryImage.delete).toHaveBeenCalledWith({
        where: { id: 'img-123' },
      });
    });

    it('prevents removing image from another winery', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery);
      // findFirst returns null because the query includes wineryId check
      mockDb.wineryGalleryImage.findFirst.mockResolvedValueOnce(null);

      const result = await removeGalleryImage('other-winery-img');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});
