import { ExperienceType } from '@prisma/client';

export const EXPERIENCE_TYPE_COLORS: Record<ExperienceType, string> = {
  TASTING: '#8B5CF6', // Purple
  CELLAR_VISIT: '#3B82F6', // Blue
  WORKSHOP: '#10B981', // Green
  VINEYARD_TOUR: '#F59E0B', // Amber
  FOOD_PAIRING: '#EF4444', // Red
  MEAL: '#EC4899', // Pink
  EVENT: '#6366F1', // Indigo
};

export const EXPERIENCE_TYPE_BG_COLORS: Record<ExperienceType, string> = {
  TASTING: 'bg-purple-500',
  CELLAR_VISIT: 'bg-blue-500',
  WORKSHOP: 'bg-emerald-500',
  VINEYARD_TOUR: 'bg-amber-500',
  FOOD_PAIRING: 'bg-red-500',
  MEAL: 'bg-pink-500',
  EVENT: 'bg-indigo-500',
};

export const EXPERIENCE_TYPE_TEXT_COLORS: Record<ExperienceType, string> = {
  TASTING: 'text-purple-600',
  CELLAR_VISIT: 'text-blue-600',
  WORKSHOP: 'text-emerald-600',
  VINEYARD_TOUR: 'text-amber-600',
  FOOD_PAIRING: 'text-red-600',
  MEAL: 'text-pink-600',
  EVENT: 'text-indigo-600',
};

export const EXPERIENCE_TYPE_LIGHT_BG_COLORS: Record<ExperienceType, string> = {
  TASTING: 'bg-purple-100',
  CELLAR_VISIT: 'bg-blue-100',
  WORKSHOP: 'bg-emerald-100',
  VINEYARD_TOUR: 'bg-amber-100',
  FOOD_PAIRING: 'bg-red-100',
  MEAL: 'bg-pink-100',
  EVENT: 'bg-indigo-100',
};

export const EXPERIENCE_TYPE_LABELS: Record<ExperienceType, string> = {
  TASTING: 'Wine Tasting',
  CELLAR_VISIT: 'Cellar Visit',
  WORKSHOP: 'Workshop',
  VINEYARD_TOUR: 'Vineyard Tour',
  FOOD_PAIRING: 'Food Pairing',
  MEAL: 'Meal at the Winery',
  EVENT: 'Event',
};
