// Shared TypeScript types for EnCave

export type { UserRole } from '@prisma/client';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'CLIENT' | 'WINEMAKER' | 'ADMIN';
  createdAt: Date;
}

export type { ActionResult, ErrorCode } from './actions';
