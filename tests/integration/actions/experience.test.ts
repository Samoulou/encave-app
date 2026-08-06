import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock the db module
vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
    },
    experience: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    experienceGalleryImage: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((fn) =>
      fn({
        experience: {
          create: vi.fn(),
          update: vi.fn(),
        },
        experienceGalleryImage: {
          createMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      })
    ),
  },
}));

// Mock Vercel Blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';

// Import actions after mocks
const {
  publishExperience,
  unpublishExperience,
  archiveExperience,
  duplicateExperience,
} = await import('@/server/actions/experience');

describe('Experience Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishExperience', () => {
    it('returns UNAUTHORIZED when user is not logged in', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const result = await publishExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when winery is not verified', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'PENDING',
      } as never);

      const result = await publishExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns NOT_FOUND when experience does not exist', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue(null);

      const result = await publishExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR when experience is not DRAFT', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        status: 'PUBLISHED', // Not DRAFT
      } as never);

      const result = await publishExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('draft');
      }
    });

    it('successfully publishes a DRAFT experience', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        status: 'DRAFT',
      } as never);
      vi.mocked(db.experience.update).mockResolvedValue({
        id: 'exp-123',
        status: 'PUBLISHED',
      } as never);

      const result = await publishExperience('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('PUBLISHED');
      }
      expect(db.experience.update).toHaveBeenCalledWith({
        where: { id: 'exp-123' },
        data: { status: 'PUBLISHED' },
      });
    });

    it('returns VALIDATION_ERROR when Stripe is not connected', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
        stripeAccountId: null,
        stripeOnboardingComplete: false,
      } as never);

      const result = await publishExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Stripe');
      }
    });

    it('returns VALIDATION_ERROR when Stripe onboarding is incomplete', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: false,
      } as never);

      const result = await publishExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('onboarding');
      }
    });
  });

  describe('unpublishExperience', () => {
    it('returns VALIDATION_ERROR when experience is not PUBLISHED', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        status: 'DRAFT', // Not PUBLISHED
      } as never);

      const result = await unpublishExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('published');
      }
    });

    it('successfully unpublishes a PUBLISHED experience', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        status: 'PUBLISHED',
      } as never);
      vi.mocked(db.experience.update).mockResolvedValue({
        id: 'exp-123',
        status: 'DRAFT',
      } as never);

      const result = await unpublishExperience('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('DRAFT');
      }
    });
  });

  describe('archiveExperience', () => {
    it('returns VALIDATION_ERROR when experience is already ARCHIVED', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        status: 'ARCHIVED',
      } as never);

      const result = await archiveExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('already archived');
      }
    });

    it('successfully archives a DRAFT experience', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        status: 'DRAFT',
      } as never);
      vi.mocked(db.experience.update).mockResolvedValue({
        id: 'exp-123',
        status: 'ARCHIVED',
      } as never);

      const result = await archiveExperience('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ARCHIVED');
      }
    });

    it('successfully archives a PUBLISHED experience', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        status: 'PUBLISHED',
      } as never);
      vi.mocked(db.experience.update).mockResolvedValue({
        id: 'exp-123',
        status: 'ARCHIVED',
      } as never);

      const result = await archiveExperience('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ARCHIVED');
      }
    });
  });

  describe('duplicateExperience', () => {
    it('creates a copy with DRAFT status', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        title: 'Original Experience',
        description: 'Test description',
        type: 'TASTING',
        duration: 60,
        price: 5000,
        minCapacity: 2,
        maxCapacity: 10,
        coverPhoto: 'https://example.com/photo.jpg',
        status: 'PUBLISHED',
        galleryImages: [],
      } as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(null); // No duplicate slug

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          experience: {
            create: vi.fn().mockResolvedValue({
              id: 'exp-456',
              slug: 'original-experience-copy',
              status: 'DRAFT',
            }),
          },
          experienceGalleryImage: {
            createMany: vi.fn(),
          },
        };
        return fn(tx);
      });
      vi.mocked(db.$transaction).mockImplementation(mockTransaction);

      const result = await duplicateExperience('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slug).toContain('copy');
      }
    });

    it('generates unique slug for duplicate', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@test.com', role: 'WINEMAKER' },
        expires: '',
      });
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: 'winery-123',
        status: 'VERIFIED',
      } as never);
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        title: 'Test Experience',
        description: 'Description',
        type: 'TASTING',
        duration: 60,
        price: 5000,
        minCapacity: 1,
        maxCapacity: 10,
        coverPhoto: 'https://example.com/photo.jpg',
        status: 'PUBLISHED',
        galleryImages: [
          { id: 'img-1', url: 'https://example.com/img1.jpg', order: 0 },
        ],
      } as never);

      // First call finds existing slug, second call finds no duplicate
      vi.mocked(db.experience.findUnique)
        .mockResolvedValueOnce({ id: 'existing' } as never)
        .mockResolvedValueOnce(null);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          experience: {
            create: vi.fn().mockResolvedValue({
              id: 'exp-456',
              slug: 'test-experience-copy-1',
              status: 'DRAFT',
            }),
          },
          experienceGalleryImage: {
            createMany: vi.fn(),
          },
        };
        return fn(tx);
      });
      vi.mocked(db.$transaction).mockImplementation(mockTransaction);

      const result = await duplicateExperience('exp-123');

      expect(result.success).toBe(true);
    });
  });
});
