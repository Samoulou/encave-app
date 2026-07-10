import { revalidateTag } from 'next/cache';

/**
 * Invalidate winery-related caches after a mutation that can change
 * the public visibility of a winery (ENC-027).
 *
 * Also touches the `experiences` tag because the winery visibility
 * filter is applied to experience queries — a winery flipping from
 * invisible to visible immediately impacts the experience listing.
 *
 * P-06 (L-212): tags ONLY. The two tags cover every public page (all
 * public reads are unstable_cache tagged 'wineries'/'experiences'), and
 * with ISR the tags also invalidate the Full Route Cache of the pages
 * that consumed them — the old revalidatePath fan-out (12 paths × 4
 * locales incl. the home) evicted whole page trees on every mutation
 * and violated the CLAUDE.md rule « never tag+path for the same data ».
 */
export function invalidateWineryCaches(_winerySlug?: string) {
  revalidateTag('wineries');
  revalidateTag('experiences');
}
