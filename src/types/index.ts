// Shared TypeScript types for EnCave

export type UserRole = 'USER' | 'WINEMAKER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
}
