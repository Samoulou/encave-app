import { auth } from '@/server/better-auth';
import { toNextJsHandler } from 'better-auth/next-js';

/**
 * Better Auth route handler
 * Handles all /api/auth/* requests
 */
export const { GET, POST } = toNextJsHandler(auth);
