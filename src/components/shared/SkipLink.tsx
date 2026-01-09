'use client';

/**
 * Skip to main content link for keyboard/screen reader users.
 * Hidden by default, visible on focus for keyboard navigation.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-burgundy-600 focus:text-white focus:rounded-lg focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-burgundy-400 focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
