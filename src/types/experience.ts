import type { ExperienceType, ExperienceStatus } from '@prisma/client';

export type { ExperienceType, ExperienceStatus } from '@prisma/client';

/**
 * Experience data for forms and display
 */
export interface ExperienceFormData {
  id?: string;
  title: string;
  type: ExperienceType;
  description: string;
  duration: number;
  price: number; // in CHF (not cents for form display)
  minCapacity: number;
  maxCapacity: number;
  coverPhoto?: string;
  galleryImages?: { id: string; url: string; order: number }[];
}

/**
 * Experience with winery info for public display
 */
export interface ExperiencePublic {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: ExperienceType;
  duration: number;
  price: number; // in cents
  minCapacity: number;
  maxCapacity: number;
  coverPhoto: string;
  status: ExperienceStatus;
  winery: {
    id: string;
    name: string;
    slug: string;
    commune: string;
  };
  galleryImages: { id: string; url: string; order: number }[];
}

/**
 * Experience for dashboard management
 */
export interface ExperienceWithStatus {
  id: string;
  title: string;
  slug: string;
  type: ExperienceType;
  duration: number;
  price: number;
  status: ExperienceStatus;
  coverPhoto: string;
  createdAt: Date;
  updatedAt: Date;
}
