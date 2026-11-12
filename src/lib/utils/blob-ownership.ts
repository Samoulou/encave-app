/**
 * Ownership check for Vercel Blob URLs (pre-launch audit, H2).
 *
 * Every upload action writes under an owner-scoped folder of the single
 * public store:
 *  - winery media      → `wineries/{userId}/…`      (uploadWineryImage)
 *  - experience media  → `experiences/{wineryId}/…` (uploadExperienceImage)
 *
 * A URL coming back from the client must be PARSED and matched against
 * that folder before it is persisted and, above all, before it reaches
 * `del()`: the store token can delete ANY blob, so an unchecked URL lets
 * one account delete another tenant's images. Never use a substring test
 * (`includes`) — a query string or fragment satisfies it.
 */

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

/** Folder of the winery media uploaded by this user (uploadWineryImage). */
export function wineryBlobPrefix(userId: string): string {
  return `wineries/${userId}/`;
}

/** Folder of the experience media of this winery (uploadExperienceImage). */
export function experienceBlobPrefix(wineryId: string): string {
  return `experiences/${wineryId}/`;
}

/**
 * True only when `url` is an https URL of the public Blob store whose
 * path sits inside `ownerPrefix`. Anything else — another tenant's
 * folder, another host, a relative `/images/…` path, an Unsplash seed
 * URL, a query string or fragment, a malformed value — is false.
 */
export function isOwnedBlobUrl(url: unknown, ownerPrefix: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || ownerPrefix.length === 0) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username !== '' || parsed.password !== '') return false;
  if (parsed.port !== '') return false;
  if (!parsed.hostname.toLowerCase().endsWith(BLOB_HOST_SUFFIX)) return false;
  // del() must receive exactly the blob we authorized, nothing appended.
  if (parsed.search !== '' || parsed.hash !== '') return false;

  // `new URL` already collapsed `.`/`..` segments (encoded or not), so the
  // pathname is the real target. Decode once to reject separators or
  // traversal smuggled through percent-encoding.
  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return false;
  }
  if (pathname.includes('\\') || pathname.split('/').includes('..')) {
    return false;
  }

  const expectedStart = `/${ownerPrefix}`;
  return (
    pathname.startsWith(expectedStart) && pathname.length > expectedStart.length
  );
}

/**
 * Same-origin static asset under `public/images/` (the seed / demo covers,
 * e.g. `/images/herobanner-image-v2.jpg`). A plain absolute path made of
 * safe characters only: no scheme, no host (`//evil.test`), no traversal,
 * no query or fragment. Such a value is harmless to store — and is never a
 * blob, so it is never passed to `del()`.
 */
const LOCAL_IMAGE_PATH = /^\/images\/[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

export function isLocalImagePath(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  if (!LOCAL_IMAGE_PATH.test(url)) return false;
  return !url.includes('//') && !url.split('/').includes('..');
}
