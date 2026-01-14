# EnCave Performance Patterns

> **Source:** Architecture standards for perceived performance
> **Last Updated:** 2026-01-14

This document defines the patterns and standards for ensuring excellent perceived performance in the EnCave application. The goal is **instant visual feedback** for all user interactions.

---

## Core Principle: Perceived Performance > Actual Performance

Users don't care about milliseconds of server response time. They care about:
1. **Did my click register?** (< 50ms feedback)
2. **Is something happening?** (visual progress)
3. **When will it finish?** (predictable loading states)

---

## Pattern 1: Non-Blocking Navigation with useTransition

**Problem:** Navigation blocks UI until new page data loads.

**Solution:** Wrap all navigation in `startTransition` for non-blocking updates.

### Standard Hook

```typescript
// src/hooks/useNavigateWithTransition.ts
'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useCallback } from 'react';

export function useNavigateWithTransition() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      startTransition(() => {
        router.push(href, options);
      });
    },
    [router]
  );

  const prefetch = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  return { navigate, prefetch, isPending };
}
```

### Usage

```typescript
'use client';

import { useNavigateWithTransition } from '@/hooks/useNavigateWithTransition';

export function BookingCard({ booking }) {
  const { navigate, isPending } = useNavigateWithTransition();

  return (
    <button
      onClick={() => navigate(`/bookings/${booking.id}`)}
      disabled={isPending}
      className={isPending ? 'opacity-50' : ''}
    >
      {isPending ? 'Loading...' : 'View Details'}
    </button>
  );
}
```

---

## Pattern 2: Optimistic UI with useOptimistic

**Problem:** Filter/sort changes wait for server before updating UI.

**Solution:** Update UI immediately, sync with server in background.

### Standard Pattern

```typescript
'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function FilterableList({ initialFilters, children }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticFilters, setOptimisticFilters] = useOptimistic(initialFilters);

  const updateFilter = (key: string, value: string) => {
    // Step 1: Update UI IMMEDIATELY (optimistic)
    setOptimisticFilters((prev) => ({ ...prev, [key]: value }));

    // Step 2: Sync with server (non-blocking)
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className={isPending ? 'opacity-70 transition-opacity' : ''}>
      {children({ filters: optimisticFilters, updateFilter, isPending })}
    </div>
  );
}
```

### Visual Pending States

```css
/* Standard pending state - use consistently across app */
.pending-state {
  opacity: 0.7;
  pointer-events: none;
  transition: opacity 150ms ease-out;
}

/* Optional: Add subtle blur for heavy updates */
.pending-state-blur {
  opacity: 0.7;
  filter: blur(1px);
  pointer-events: none;
  transition: all 150ms ease-out;
}
```

---

## Pattern 3: Route Prefetching

**Problem:** Navigation feels slow because page data loads after click.

**Solution:** Prefetch routes before user clicks.

### Link Prefetch (Default)

```tsx
// next/link prefetches by default - ensure not disabled
import Link from 'next/link';

// GOOD - prefetch enabled (default)
<Link href="/experiences">Experiences</Link>

// GOOD - explicit prefetch
<Link href="/experiences" prefetch={true}>Experiences</Link>

// BAD - only disable for rarely visited pages
<Link href="/terms" prefetch={false}>Terms</Link>
```

### Hover Prefetch for Dynamic Routes

```typescript
// src/components/layout/NavLink.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function NavLink({ href, children, prefetch = true }) {
  const router = useRouter();

  const handleHover = () => {
    if (prefetch) {
      router.prefetch(href);
    }
  };

  return (
    <Link
      href={href}
      onMouseEnter={handleHover}
      onFocus={handleHover}
    >
      {children}
    </Link>
  );
}
```

### Pagination Prefetch

```typescript
// Prefetch next/prev pages for instant pagination
export function Pagination({ currentPage, totalPages }) {
  const router = useRouter();

  useEffect(() => {
    // Prefetch adjacent pages
    if (currentPage > 1) {
      router.prefetch(`?page=${currentPage - 1}`);
    }
    if (currentPage < totalPages) {
      router.prefetch(`?page=${currentPage + 1}`);
    }
  }, [currentPage, totalPages, router]);

  // ... render pagination UI
}
```

---

## Pattern 4: Granular Suspense Boundaries

**Problem:** Single Suspense boundary shows full-page skeleton for any slow component.

**Solution:** Wrap each section independently for progressive streaming.

### Page Structure

```tsx
// RECOMMENDED: Granular boundaries
export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Renders instantly - no data */}
      <PageHeader title="Dashboard" />

      {/* Stream 1: Stats (fast query) */}
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* Stream 2: Recent activity (medium query) */}
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity />
      </Suspense>

      {/* Stream 3: Full table (slow query) */}
      <Suspense fallback={<TableSkeleton />}>
        <BookingsTable />
      </Suspense>
    </div>
  );
}

// AVOID: Single boundary
export default async function DashboardPage() {
  return (
    <Suspense fallback={<FullPageSkeleton />}>
      <EntireDashboard /> {/* All or nothing */}
    </Suspense>
  );
}
```

### Skeleton Matching

Each Suspense boundary must have a skeleton that **matches the exact dimensions** of its content:

```tsx
// Skeleton must match content layout
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-lg bg-stone-200 animate-pulse" />
      ))}
    </div>
  );
}
```

---

## Pattern 5: Debounced Search with Stale-While-Revalidate

**Problem:** Search triggers request on every keystroke, causing flicker.

**Solution:** Debounce input, keep stale results visible during update.

### Standard Hook

```typescript
// src/hooks/useDebouncedSearch.ts
'use client';

import { useState, useEffect, useTransition, useOptimistic } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface UseDebouncedSearchOptions {
  delay?: number;
  paramName?: string;
}

export function useDebouncedSearch({
  delay = 300,
  paramName = 'q',
}: UseDebouncedSearchOptions = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const serverQuery = searchParams.get(paramName) || '';
  const [inputValue, setInputValue] = useState(serverQuery);
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(serverQuery);

  useEffect(() => {
    // Sync input when URL changes externally
    setInputValue(serverQuery);
  }, [serverQuery]);

  useEffect(() => {
    if (inputValue === serverQuery) return;

    const timer = setTimeout(() => {
      setOptimisticQuery(inputValue);
      startTransition(() => {
        const params = new URLSearchParams(searchParams);
        if (inputValue) {
          params.set(paramName, inputValue);
        } else {
          params.delete(paramName);
        }
        router.push(`?${params.toString()}`, { scroll: false });
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [inputValue, delay, paramName, router, searchParams, serverQuery]);

  return {
    inputValue,
    setInputValue,
    query: optimisticQuery,
    isPending,
    isStale: inputValue !== serverQuery,
  };
}
```

### Usage

```tsx
export function SearchBar() {
  const { inputValue, setInputValue, isPending, isStale } = useDebouncedSearch();

  return (
    <div className="relative">
      <input
        type="search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Search experiences..."
        className={isStale ? 'border-amber-400' : ''}
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
      )}
    </div>
  );
}

export function SearchResults({ results }) {
  const { isPending } = useDebouncedSearch();

  return (
    <div className={isPending ? 'opacity-50 transition-opacity' : ''}>
      {results.map((result) => (
        <ResultCard key={result.id} result={result} />
      ))}
    </div>
  );
}
```

---

## Pattern 6: Loading.tsx Files

Next.js `loading.tsx` files provide automatic Suspense boundaries at the route level.

### Requirements

1. **Every route segment** with async data should have a `loading.tsx`
2. **Skeletons must match** the actual page layout exactly
3. **Use SkeletonContainer** for accessibility

### Standard Template

```tsx
// src/app/[locale]/(protected)/dashboard/bookings/loading.tsx
import { SkeletonContainer } from '@/components/shared/Skeleton';

export default function Loading() {
  return (
    <SkeletonContainer label="Loading bookings">
      <div className="space-y-6">
        {/* Match exact page structure */}
        <div className="h-10 w-48 bg-stone-200 rounded animate-pulse" />

        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-stone-200 rounded-lg animate-pulse" />
          ))}
        </div>

        <div className="h-96 bg-stone-200 rounded-lg animate-pulse" />
      </div>
    </SkeletonContainer>
  );
}
```

---

## Performance Checklist

When implementing any interactive feature, verify:

- [ ] **Navigation uses useTransition** - No blocking UI updates
- [ ] **Filters use useOptimistic** - Instant visual feedback
- [ ] **Links prefetch** - Critical paths load before click
- [ ] **Suspense is granular** - Sections stream independently
- [ ] **Search is debounced** - No request spam, stale results visible
- [ ] **Skeletons match content** - No layout shift (CLS < 0.1)
- [ ] **Pending states visible** - User knows action registered

---

## Anti-Patterns to Avoid

### 1. Blocking Navigation

```typescript
// BAD - Blocks until complete
const handleClick = async () => {
  await someAsyncOperation();
  router.push('/next-page');
};

// GOOD - Non-blocking
const handleClick = () => {
  startTransition(() => {
    router.push('/next-page');
  });
};
```

### 2. Full Page Suspense

```tsx
// BAD - All or nothing
<Suspense fallback={<FullPageLoader />}>
  <Header />
  <Stats />
  <Table />
</Suspense>

// GOOD - Progressive streaming
<Header />
<Suspense fallback={<StatsSkeleton />}>
  <Stats />
</Suspense>
<Suspense fallback={<TableSkeleton />}>
  <Table />
</Suspense>
```

### 3. No Optimistic Updates

```typescript
// BAD - Wait for server
const handleFilter = async (value) => {
  await updateServerFilter(value);
  // UI updates after server responds
};

// GOOD - Update immediately
const handleFilter = (value) => {
  setOptimisticFilter(value); // Instant UI update
  startTransition(() => {
    router.push(`?filter=${value}`); // Server sync
  });
};
```

### 4. Missing Prefetch

```tsx
// BAD - Load on click
<Link href="/dashboard" prefetch={false}>Dashboard</Link>

// GOOD - Prefetch on hover
<Link href="/dashboard" prefetch={true}>Dashboard</Link>
```

---

## Related Documentation

- `docs/architecture/coding-standards.md` - General coding standards
- `docs/stories/7.2.loading-states-feedback.md` - Skeleton components, progress bar
- `docs/stories/8.5.performance-code-polish.md` - Server-side performance
- `docs/stories/8.7.navigation-fluidity.md` - Implementation story

---

_Reference: Full architecture at `docs/architecture.md`_
