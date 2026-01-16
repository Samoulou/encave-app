/**
 * Generate a URL-safe slug from a string
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

/**
 * Ensure slug uniqueness by appending a counter if needed
 * @param baseSlug - The base slug to check
 * @param checkExists - Async function that returns true if slug already exists
 * @returns A unique slug
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  checkExists: (_slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;

    // Safety limit to prevent infinite loops
    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  return slug;
}
