/**
 * Image placeholder utilities for blur-up loading effect
 * Prevents CLS (Cumulative Layout Shift) by showing a placeholder while images load
 */

/**
 * Generate an SVG shimmer placeholder
 * Uses the burgundy theme color for brand consistency
 */
function shimmer(width: number, height: number): string {
  return `
<svg width="${width}" height="${height}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#e9e2e5" offset="20%" />
      <stop stop-color="#f4edf0" offset="50%" />
      <stop stop-color="#e9e2e5" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#e9e2e5" />
  <rect id="r" width="${width}" height="${height}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${width}" to="${width}" dur="1s" repeatCount="indefinite"  />
</svg>`;
}

/**
 * Convert string to base64
 */
function toBase64(str: string): string {
  if (typeof window === 'undefined') {
    return Buffer.from(str).toString('base64');
  }
  return window.btoa(str);
}

/**
 * Generate a data URL for use as blurDataURL in Next.js Image component
 * @param width - Width of the placeholder SVG
 * @param height - Height of the placeholder SVG
 * @returns Data URL string for use in blurDataURL prop
 */
export function getImagePlaceholder(width = 700, height = 475): string {
  return `data:image/svg+xml;base64,${toBase64(shimmer(width, height))}`;
}

/**
 * Pre-generated placeholders for common aspect ratios
 */
export const IMAGE_PLACEHOLDERS = {
  /** 4:3 aspect ratio (common for cards) */
  card: getImagePlaceholder(400, 300),
  /** 16:9 aspect ratio (common for heroes) */
  hero: getImagePlaceholder(1600, 900),
  /** 1:1 aspect ratio (common for thumbnails) */
  square: getImagePlaceholder(400, 400),
  /** 3:2 aspect ratio (common for photos) */
  photo: getImagePlaceholder(600, 400),
} as const;

/**
 * Default placeholder for any image
 */
export const DEFAULT_BLUR_PLACEHOLDER = IMAGE_PLACEHOLDERS.card;
