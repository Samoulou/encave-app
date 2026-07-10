import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import {
  PUBLIC_BASE_NAMESPACES,
  SEGMENT_EXTRA_NAMESPACES,
} from '@/lib/i18n/client-messages';

/**
 * Static guard for the i18n client subsets (P-06 / L-203).
 *
 * Every 'use client' component reachable from a PUBLIC route must find
 * its useTranslations() namespaces in the provider of that route group
 * (BASE for the root, BASE+EXTRA for segments). Protected/admin routes
 * get the full messages — out of scope here.
 *
 * The mapping below mirrors the layouts. When a public page starts
 * using a client component with a NEW namespace, this test fails and
 * points at the layout to extend.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.(tsx|ts)$/.test(entry)) acc.push(path);
  }
  return acc;
}

function isClientComponent(source: string): boolean {
  const head = source.split('\n', 3).join('\n');
  return head.includes("'use client'") || head.includes('"use client"');
}

function usedNamespaces(source: string): string[] {
  const out = new Set<string>();
  for (const match of source.matchAll(
    /useTranslations\(\s*['"]([\w.]+)['"]/g
  )) {
    const ns = match[1];
    if (ns) out.add(ns);
  }
  for (const match of source.matchAll(/useTranslations<'([\w.]+)'>\(\)/g)) {
    const ns = match[1];
    if (ns) out.add(ns);
  }
  return [...out];
}

/** True when `ns` is covered by a provider list (top-level or dotted). */
function covered(ns: string, provided: readonly string[]): boolean {
  return provided.some(
    (p) => p === ns || ns.startsWith(`${p}.`) || p.startsWith(`${ns}.`)
  );
}

// Component directories reachable from each public surface. Directories
// used ONLY by protected/admin surfaces are deliberately absent.
const PUBLIC_SURFACES: Record<
  string,
  { provided: readonly string[]; componentDirs: string[]; appDirs: string[] }
> = {
  'root (home, auth, legal, about)': {
    provided: PUBLIC_BASE_NAMESPACES,
    componentDirs: [
      'components/layout',
      'components/shared',
      'components/features/home',
      'components/features/auth',
      'components/features/map',
    ],
    appDirs: ['app/[locale]/(auth)'],
  },
  'experiences segment': {
    provided: [
      ...PUBLIC_BASE_NAMESPACES,
      ...SEGMENT_EXTRA_NAMESPACES.experiences,
    ],
    componentDirs: [
      'components/features/experience',
      'components/features/search',
      'components/features/checkout',
      'components/features/map',
    ],
    appDirs: ['app/[locale]/(public)/experiences'],
  },
  'wineries segment': {
    provided: [...PUBLIC_BASE_NAMESPACES, ...SEGMENT_EXTRA_NAMESPACES.wineries],
    componentDirs: ['components/features/winery', 'components/features/map'],
    appDirs: ['app/[locale]/(public)/wineries'],
  },
  'booking segment': {
    provided: [...PUBLIC_BASE_NAMESPACES, ...SEGMENT_EXTRA_NAMESPACES.booking],
    componentDirs: ['components/features/booking'],
    appDirs: ['app/[locale]/(public)/booking'],
  },
  'reservation segment (error page)': {
    provided: PUBLIC_BASE_NAMESPACES,
    componentDirs: [],
    appDirs: ['app/[locale]/(public)/reservation'],
  },
};

// Client components living in public component dirs but only ever
// mounted on PROTECTED routes (full messages there). Reviewed manually.
const PROTECTED_ONLY_FILES = [
  // dashboard-only shell/badges (mounted under (protected) exclusively)
  `layout${sep}ClientDashboardSidebar.tsx`,
  `features${sep}booking${sep}BookingStatusBadge.tsx`,
  `features${sep}winery${sep}PaymentStatus.tsx`,
  `features${sep}winery${sep}StripeOnboarding.tsx`,
  `features${sep}winery${sep}StripeCallbackResult.tsx`,
  `features${sep}winery${sep}WineryBasicInfoSection.tsx`,
  `features${sep}winery${sep}WineryContactSection.tsx`,
  `features${sep}winery${sep}WineryAddressSection.tsx`,
  `features${sep}winery${sep}WineryProfileForm.tsx`,
  `features${sep}winery${sep}CancellationPolicySection.tsx`,
  `features${sep}booking${sep}calendar`,
  `features${sep}booking${sep}BookingsTable`,
  `features${sep}booking${sep}BookingActionsMenu`,
  `features${sep}booking${sep}dashboard`,
  `features${sep}experience${sep}form`,
  `features${sep}experience${sep}ExperienceManagement`,
  `features${sep}experience${sep}ExperiencesList`,
  `features${sep}experience${sep}DeleteExperienceDialog`,
  `features${sep}experience${sep}availability`,
  `features${sep}search${sep}SavedSearches`,
  `features${sep}shared${sep}ImageUpload.tsx`,
  `components${sep}shared${sep}ImageUpload.tsx`,
];

function isProtectedOnly(path: string): boolean {
  return PROTECTED_ONLY_FILES.some((fragment) => path.includes(fragment));
}

describe('i18n client-namespace coverage (P-06 / L-203)', () => {
  for (const [surface, config] of Object.entries(PUBLIC_SURFACES)) {
    it(`${surface}: every client useTranslations() namespace is provided`, () => {
      const dirs = [...config.componentDirs, ...config.appDirs].map((d) =>
        join(SRC, d)
      );
      const violations: string[] = [];

      for (const dir of dirs) {
        let files: string[] = [];
        try {
          files = walk(dir);
        } catch {
          continue; // directory may not exist
        }
        for (const file of files) {
          if (isProtectedOnly(file)) continue;
          const source = readFileSync(file, 'utf-8');
          if (!isClientComponent(source)) continue;
          for (const ns of usedNamespaces(source)) {
            if (!covered(ns, config.provided)) {
              violations.push(`${file.replace(SRC + sep, '')} → '${ns}'`);
            }
          }
        }
      }

      expect(violations, violations.join('\n')).toEqual([]);
    });
  }
});
