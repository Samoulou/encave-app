import { describe, it, expect } from 'vitest';
import { createExperienceSchema } from '@/lib/validators/experience';

describe('createExperienceSchema', () => {
  const validInput = {
    title: 'Grand Cru Wine Tasting',
    type: 'TASTING' as const,
    description:
      'Join us for an exceptional wine tasting experience featuring our finest Grand Cru selections. You will taste five premium wines paired with local cheeses.',
    duration: 60,
    price: 50,
    minCapacity: 2,
    maxCapacity: 10,
  };

  it('accepts valid input', () => {
    const result = createExperienceSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  // AC 6: Validation rejects title > 100 chars
  it('rejects title longer than 100 characters', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      title: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('title');
    }
  });

  it('rejects empty title', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      title: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('title');
    }
  });

  // AC 6: Validation rejects description < 100 chars
  it('rejects description shorter than 100 characters', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      description: 'Too short description',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('description');
    }
  });

  it('accepts description with exactly 100 characters', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      description: 'A'.repeat(100),
    });
    expect(result.success).toBe(true);
  });

  // AC 6: Validation rejects price <= 0
  it('rejects price of 0', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      price: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('price');
    }
  });

  it('rejects negative price', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      price: -10,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('price');
    }
  });

  it('accepts positive price', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      price: 1,
    });
    expect(result.success).toBe(true);
  });

  // AC 6: Validation rejects minCapacity < 1
  it('rejects minCapacity less than 1', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      minCapacity: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('minCapacity');
    }
  });

  // AC 6: Validation rejects maxCapacity < minCapacity
  it('rejects maxCapacity less than minCapacity', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      minCapacity: 5,
      maxCapacity: 3,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('maxCapacity');
    }
  });

  it('accepts maxCapacity equal to minCapacity', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      minCapacity: 5,
      maxCapacity: 5,
    });
    expect(result.success).toBe(true);
  });

  it('accepts maxCapacity greater than minCapacity', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      minCapacity: 2,
      maxCapacity: 20,
    });
    expect(result.success).toBe(true);
  });

  // Experience type validation
  it('rejects invalid experience type', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      type: 'INVALID_TYPE',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('type');
    }
  });

  it('accepts all valid experience types', () => {
    const types = [
      'TASTING',
      'CELLAR_VISIT',
      'WORKSHOP',
      'VINEYARD_TOUR',
      'FOOD_PAIRING',
    ] as const;

    for (const type of types) {
      const result = createExperienceSchema.safeParse({
        ...validInput,
        type,
      });
      expect(result.success).toBe(true);
    }
  });

  // Duration validation
  it('accepts valid duration values', () => {
    const durations = [60, 90, 120, 180, 240];

    for (const duration of durations) {
      const result = createExperienceSchema.safeParse({
        ...validInput,
        duration,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid duration values', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      duration: 45, // Not in the allowed list
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('duration');
    }
  });

  // Capacity must be integers
  it('rejects non-integer minCapacity', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      minCapacity: 2.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('minCapacity');
    }
  });

  it('rejects non-integer maxCapacity', () => {
    const result = createExperienceSchema.safeParse({
      ...validInput,
      maxCapacity: 10.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('maxCapacity');
    }
  });
});
