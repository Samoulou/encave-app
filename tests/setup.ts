import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

// Pin the timezone to UTC so date-boundary tests are deterministic and
// match production (Vercel functions run in UTC) and CI. Without this,
// code that builds a Date via setHours() (local) drifts by the machine's
// offset — e.g. the 24h cancellation boundary reads 23h on a UTC+1 host.
process.env.TZ = 'UTC';

// ||= (not ??=): an env var wired to an unset CI secret arrives as an
// EMPTY string, which must be replaced too — Zod requires a valid URL.
process.env.DATABASE_URL ||=
  'postgresql://user:password@localhost:5432/encave_test';
process.env.BETTER_AUTH_SECRET ||= 'test-secret-at-least-32-characters-long';
process.env.NODE_ENV ||= 'test';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

const nav = {
  usePathname: vi.fn(() => '/fr/dashboard'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({ locale: 'fr' })),
  redirect: vi.fn(),
  notFound: vi.fn(),
};

vi.mock('next/navigation', () => nav);

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: ({
      href,
      children,
      prefetch: _prefetch,
      ...props
    }: {
      href: string;
      children: ReactNode;
      prefetch?: boolean;
    }) => createElement('a', { href, ...props }, children),
    redirect: vi.fn(),
    usePathname: nav.usePathname,
    useRouter: nav.useRouter,
    getPathname: vi.fn(({ href }: { href: string }) => href),
  }),
}));

const labels: Record<
  string,
  string | ((_values?: Record<string, string | number>) => string)
> = {
  dashboard: 'Dashboard',
  experiences: 'Experiences',
  bookings: 'Bookings',
  earnings: 'Earnings',
  wineryProfile: 'Winery Profile',
  wines: 'Wines',
  settings: 'Settings',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  roleWinemaker: 'Winemaker',
  dashboardNavigation: 'Dashboard navigation',
  allCommunes: 'All communes',
  placeholder: 'Search experiences, wineries...',
  searchExperiences: 'Search experiences',
  clearSearch: 'Clear search',
  'types.TASTING': 'Tasting',
  'types.CELLAR_VISIT': 'Cellar Visit',
  durationFormat: (values) =>
    `${values?.count ?? 0} ${values?.count === 1 ? 'hour' : 'hours'}`,
  durationMinutes: (values) => `${values?.count ?? 0} min`,
  aboutTitle: 'About This Experience',
  capacitySingle: (values) =>
    `${values?.count ?? 0} ${values?.count === 1 ? 'person' : 'people'}`,
  capacityRange: (values) => `${values?.min ?? 0}-${values?.max ?? 0} people`,
  upTo: (values) => `Up to ${values?.count ?? 0}`,
  'currency.perPerson': 'per person',
  experienceFound: 'experience found',
  experiencesFound: 'experiences found',
  experiencesNear: (values) => `Experiences near ${values?.location ?? ''}`,
  pageOf: (values) => `Page ${values?.page ?? 1} of ${values?.totalPages ?? 1}`,
  sortBy: 'Sort by',
  'sort.distance': 'Distance',
  'sort.relevance': 'Relevance',
  'sort.priceLowToHigh': 'Price: Low to High',
  'sort.priceHighToLow': 'Price: High to Low',
  'sort.newestFirst': 'Newest First',
  noResultsFound: 'No experiences found',
  noExperiencesAtLocation: (values) =>
    `No experiences match your filters near ${values?.location ?? ''}`,
  tryDifferentFilters: 'No experiences match your filters',
  perPerson: 'per person',
  bookNow: 'Book This Experience',
  comingSoonTitle: 'Online booking coming soon!',
  contactWinery: 'Contact the winery directly to book this experience.',
};

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
  useLocale: () => 'fr',
  useTranslations:
    () => (key: string, values?: Record<string, string | number>) => {
      const label = labels[key];
      return typeof label === 'function' ? label(values) : (label ?? key);
    },
}));
