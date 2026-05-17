import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * Invalidate winery-related caches after a mutation that can change
 * the public visibility of a winery (ENC-027).
 *
 * Also touches the `experiences` tag because the winery visibility
 * filter is applied to experience queries — a winery flipping from
 * invisible to visible immediately impacts the experience listing.
 *
 * Pass the winery slug when known so the specific public page is
 * revalidated along with the listings.
 */
export function invalidateWineryCaches(winerySlug?: string) {
  // Tag-based invalidation (covers all queries reading these tags)
  revalidateTag('wineries');
  revalidateTag('experiences');

  // Listing pages — revalidate per locale (i18n routes are always prefixed)
  revalidatePath('/wineries');
  revalidatePath('/fr/wineries');
  revalidatePath('/de/wineries');
  revalidatePath('/en/wineries');

  if (winerySlug) {
    revalidatePath(`/wineries/${winerySlug}`);
    revalidatePath(`/fr/wineries/${winerySlug}`);
    revalidatePath(`/de/wineries/${winerySlug}`);
    revalidatePath(`/en/wineries/${winerySlug}`);
  }

  // Home page (featured wineries / experiences may include this winery)
  revalidatePath('/');
  revalidatePath('/fr');
  revalidatePath('/de');
  revalidatePath('/en');
}
