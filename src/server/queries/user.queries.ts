import { cache } from 'react';
import { db } from '@/server/db';

/**
 * Case-insensitive account existence check (P-04 / L-053).
 * Used by the post-payment one-tap account card to hide itself when the
 * booking email already belongs to a user — matching the same
 * insensitivity the client-booking queries use for attachment.
 */
export const userExistsByEmail = cache(async function userExistsByEmail(
  email: string
): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  return user !== null;
});
