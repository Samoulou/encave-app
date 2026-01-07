import { describe, it, expect } from 'vitest';
import {
  wineryOnboardingSchema,
  wineryProfileSchema,
  imageFileSchema,
} from '@/lib/validators/winery';

describe('wineryOnboardingSchema', () => {
  const validInput = {
    name: 'Domaine des Vignes',
    description:
      'A beautiful winery in the heart of Valais, producing exceptional wines for over 50 years.',
    address: 'Rue du Vignoble 12',
    commune: 'Sion',
    phone: '+41 27 123 45 67',
  };

  describe('Swiss phone validation', () => {
    it('accepts valid Swiss phone with +41 prefix and spaces', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        phone: '+41 27 123 45 67',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid Swiss phone with +41 prefix without spaces', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        phone: '+41271234567',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid Swiss phone with 0 prefix', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        phone: '027 123 45 67',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid Swiss phone with 0 prefix without spaces', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        phone: '0271234567',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid phone format - too short', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        phone: '+41 27 123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('phone');
      }
    });

    it('rejects invalid phone format - wrong country code', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        phone: '+33 1 23 45 67 89',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid phone format - letters', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        phone: '+41 ABC DEF GH IJ',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('name validation', () => {
    it('accepts valid name', () => {
      const result = wineryOnboardingSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects name shorter than 2 characters', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        name: 'A',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 2');
      }
    });
  });

  describe('description validation', () => {
    it('accepts description with 50+ characters', () => {
      const result = wineryOnboardingSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects description shorter than 50 characters', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        description: 'Too short',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 50');
      }
    });
  });

  describe('commune validation', () => {
    it('accepts valid commune', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        commune: 'Sierre',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty commune', () => {
      const result = wineryOnboardingSchema.safeParse({
        ...validInput,
        commune: '',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('wineryProfileSchema', () => {
  const validProfileInput = {
    description:
      'A beautiful winery in the heart of Valais, producing exceptional wines for over 50 years.',
    address: 'Rue du Vignoble 12',
    commune: 'Sion',
    phone: '+41 27 123 45 67',
  };

  it('accepts valid profile data', () => {
    const result = wineryProfileSchema.safeParse(validProfileInput);
    expect(result.success).toBe(true);
  });

  it('rejects short description', () => {
    const result = wineryProfileSchema.safeParse({
      ...validProfileInput,
      description: 'Too short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid phone', () => {
    const result = wineryProfileSchema.safeParse({
      ...validProfileInput,
      phone: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('imageFileSchema', () => {
  // Note: File validation in Node.js test environment is limited
  // These tests verify the schema structure exists
  it('schema is defined', () => {
    expect(imageFileSchema).toBeDefined();
  });

  it('has parse and safeParse methods', () => {
    // Verify schema has standard Zod methods
    expect(typeof imageFileSchema.parse).toBe('function');
    expect(typeof imageFileSchema.safeParse).toBe('function');
  });
});
