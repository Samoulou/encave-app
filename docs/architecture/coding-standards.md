# EnCave Coding Standards

> **Source:** Extracted and enriched from `docs/architecture.md`
> **Last Updated:** 2026-01-07

This document defines the coding standards and patterns for the EnCave project. All developers (human and AI) must follow these guidelines.

---

## Core Principles

1. **No `any` types** - Use Zod for runtime validation when types are uncertain
2. **Server code isolation** - Server-only code lives exclusively in `src/server/`
3. **Consistent action responses** - All Server Actions return `ActionResult<T>`
4. **Internationalization first** - All user-facing strings via `next-intl`
5. **Type-safe environment** - Access env vars only via `src/lib/env.ts`
6. **Instant feedback** - All interactions provide < 50ms visual feedback (see `performance-patterns.md`)

---

## TypeScript Standards

### Strict Mode Requirements

```typescript
// tsconfig.json enforces these
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true
  }
}
```

### Type Definitions

- Define interfaces for data models in `src/types/`
- Use Prisma-generated types for database entities
- Export shared types from barrel files (`index.ts`)

```typescript
// Prefer interfaces for objects
interface User {
  id: string;
  email: string;
  role: UserRole;
}

// Use type for unions/intersections
type UserRole = 'USER' | 'WINEMAKER' | 'ADMIN';
```

### Avoid `any`

```typescript
// BAD
function processData(data: any) { ... }

// GOOD - Use Zod for unknown data
import { z } from 'zod';

const DataSchema = z.object({
  id: z.string(),
  value: z.number(),
});

function processData(data: unknown) {
  const parsed = DataSchema.parse(data);
  // parsed is now typed
}
```

---

## Server Action Pattern

All Server Actions must return the `ActionResult<T>` type for consistent error handling.

### ActionResult Type

```typescript
// src/types/actions.ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'BOOKING_CONFLICT'
  | 'PAYMENT_FAILED'
  | 'STRIPE_ERROR'
  | 'INTERNAL_ERROR';
```

### Action Implementation

```typescript
// src/server/actions/booking.ts
'use server';

import { z } from 'zod';
import { auth } from '@/server/auth';
import { ActionResult } from '@/types/actions';

const CreateBookingSchema = z.object({
  experienceId: z.string().uuid(),
  date: z.string().date(),
  participants: z.number().min(1).max(20),
});

export async function createBookingIntent(
  input: z.infer<typeof CreateBookingSchema>
): Promise<ActionResult<{ clientSecret: string; bookingId: string }>> {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in' },
      };
    }

    // 2. Validate input
    const validated = CreateBookingSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };
    }

    // 3. Business logic...

    return { success: true, data: { clientSecret: '...', bookingId: '...' } };
  } catch (error) {
    console.error('createBookingIntent error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}
```

### Client-Side Handling

```typescript
// In a Client Component
const result = await createBookingIntent(data);

if (result.success) {
  // TypeScript knows result.data exists
  router.push(`/booking/${result.data.bookingId}`);
} else {
  // TypeScript knows result.error exists
  toast.error(result.error.message);
}
```

---

## Component Standards

### Server vs Client Components

```typescript
// Server Component (default) - No directive needed
// src/components/features/experience/ExperienceCard.tsx
export function ExperienceCard({ experience }: Props) {
  // Can access database directly
  // Cannot use hooks or browser APIs
}

// Client Component - Requires directive
// src/components/features/booking/BookingWidget.tsx
('use client');

export function BookingWidget({ experienceId }: Props) {
  const [date, setDate] = useState<Date | null>(null);
  // Can use hooks and interactivity
  // Cannot import server-only code
}
```

### Component File Structure

```typescript
// Single component per file
// src/components/features/booking/BookingWidget.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createBookingIntent } from '@/server/actions/booking';
import type { Experience } from '@/types';

interface BookingWidgetProps {
  experience: Experience;
  availableSlots: TimeSlot[];
}

export function BookingWidget({
  experience,
  availableSlots,
}: BookingWidgetProps) {
  // Implementation
}
```

### Naming Conventions

| Element          | Convention                  | Example                          |
| ---------------- | --------------------------- | -------------------------------- |
| Components       | PascalCase                  | `BookingWidget.tsx`              |
| Hooks            | camelCase with `use` prefix | `useBookingState.ts`             |
| Utils            | camelCase                   | `formatPrice.ts`                 |
| Constants        | SCREAMING_SNAKE_CASE        | `MAX_PARTICIPANTS`               |
| Types/Interfaces | PascalCase                  | `BookingStatus`                  |
| Server Actions   | camelCase verb-first        | `createBooking`, `cancelBooking` |

---

## Import Organization

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. External packages
import { z } from 'zod';
import { format } from 'date-fns';

// 3. Internal - absolute imports (@/)
import { Button } from '@/components/ui/button';
import { createBookingIntent } from '@/server/actions/booking';

// 4. Internal - types
import type { Experience, Booking } from '@/types';

// 5. Relative imports (same feature only)
import { useBookingState } from './useBookingState';
```

---

## Internationalization (i18n)

All user-facing strings must use `next-intl`:

```typescript
// In Server Component
import { getTranslations } from 'next-intl/server';

export async function ExperiencePage() {
  const t = await getTranslations('experience');
  return <h1>{t('title')}</h1>;
}

// In Client Component
'use client';
import { useTranslations } from 'next-intl';

export function BookingButton() {
  const t = useTranslations('booking');
  return <Button>{t('bookNow')}</Button>;
}
```

### Translation Files

```
public/locales/
├── fr/
│   ├── common.json
│   ├── booking.json
│   └── experience.json
└── de/
    ├── common.json
    ├── booking.json
    └── experience.json
```

---

## Environment Variables

Access environment variables only through the typed env module:

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  NEXTAUTH_SECRET: z.string().min(32),
  // ... other vars
});

export const env = envSchema.parse(process.env);

// Usage elsewhere
import { env } from '@/lib/env';
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
```

---

## Error Handling

### Server-Side Errors

```typescript
// Always catch and transform to ActionResult
try {
  await db.booking.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return {
        success: false,
        error: { code: 'BOOKING_CONFLICT', message: '...' },
      };
    }
  }
  throw error; // Re-throw unexpected errors for Sentry
}
```

### Client-Side Errors

```typescript
// Use error boundaries for unexpected errors
// Use toast notifications for user-facing errors from ActionResult
```

---

## Testing Standards

### File Naming

```
tests/
├── unit/
│   └── lib/
│       └── formatPrice.test.ts
├── integration/
│   └── actions/
│       └── booking.test.ts
└── e2e/
    └── booking-flow.spec.ts
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('formatPrice', () => {
  it('formats CHF amounts correctly', () => {
    expect(formatPrice(1000)).toBe('CHF 10.00');
  });

  it('handles zero amounts', () => {
    expect(formatPrice(0)).toBe('CHF 0.00');
  });
});
```

---

## Git Commit Standards

```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
Scope: booking, winery, auth, ui, etc.

Examples:
feat(booking): add cancellation flow
fix(auth): resolve session refresh issue
docs(api): update webhook documentation
```

---

## Perceived Performance Standards

All user interactions must provide instant visual feedback. See `performance-patterns.md` for detailed patterns:

| Pattern | When to Use |
|---------|-------------|
| `useTransition` | All programmatic navigation |
| `useOptimistic` | Filter, sort, search, pagination changes |
| Route prefetch | Critical navigation links |
| Granular Suspense | Pages with multiple data sources |
| Debounced search | Text input that triggers server requests |

### Quick Reference

```typescript
// Navigation - always use useTransition
const [isPending, startTransition] = useTransition();
startTransition(() => router.push(href));

// Filters - always use useOptimistic
const [optimistic, setOptimistic] = useOptimistic(serverValue);
setOptimistic(newValue); // Instant UI update
startTransition(() => router.push(`?filter=${newValue}`));

// Links - enable prefetch
<Link href="/path" prefetch={true}>...</Link>
```

---

_Reference: Full architecture at `docs/architecture.md`_
_Reference: Performance patterns at `docs/architecture/performance-patterns.md`_
