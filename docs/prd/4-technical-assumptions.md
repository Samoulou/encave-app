# 4. Technical Assumptions

## 4.1 Repository Structure: Monorepo

Single repository with Next.js full-stack application:

```
encave/
├── src/
│   ├── app/           # Next.js App Router (pages + API)
│   ├── components/    # React components
│   ├── lib/           # Business logic, utilities
│   ├── server/        # Server-only code (DB, services)
│   └── types/         # Shared TypeScript types
├── prisma/            # Database schema & migrations
├── public/            # Static assets
├── docs/
└── tests/
```

## 4.2 Service Architecture: Next.js Full-Stack Monolith

| Layer         | Technology                             |
| ------------- | -------------------------------------- |
| Rendering     | React Server Components (RSC)          |
| Mutations     | Server Actions + API Routes            |
| Data fetching | Direct DB queries in Server Components |
| External APIs | API Routes (Stripe webhooks)           |

## 4.3 Tech Stack

| Layer                | Choice                    | Rationale                                                  |
| -------------------- | ------------------------- | ---------------------------------------------------------- |
| **Framework**        | Next.js 14+ (App Router)  | Full-stack React; SSR for SEO; excellent DX                |
| **Language**         | TypeScript                | Type safety end-to-end                                     |
| **Database**         | PostgreSQL                | Robust, free, excellent support                            |
| **ORM**              | Prisma                    | Type-safe queries; migrations; excellent with Next.js      |
| **Auth**             | NextAuth.js (Auth.js)     | Standard Next.js; providers multiples; session JWT         |
| **Hosting**          | Vercel                    | Native Next.js deployment; edge functions; preview deploys |
| **Database Hosting** | Neon or Supabase          | PostgreSQL serverless; free tier; Vercel integration       |
| **Payments**         | Stripe Connect            | Marketplace payments; Swiss support; handles PCI           |
| **Email**            | Resend                    | Modern API; React Email support                            |
| **File Storage**     | Vercel Blob or Cloudinary | Images; CDN integrated                                     |
| **Styling**          | Tailwind CSS              | Rapid UI development                                       |
| **UI Components**    | shadcn/ui                 | Accessible; customizable; no lock-in                       |

## 4.4 Testing Requirements

| Layer           | Tool                   |
| --------------- | ---------------------- |
| Unit tests      | Vitest                 |
| Component tests | React Testing Library  |
| Integration     | Vitest + test database |
| E2E (Phase 2)   | Playwright             |

**Coverage targets:**

- Business logic: 80%+ coverage
- API endpoints: Integration tests for happy paths + key error cases

## 4.5 Additional Technical Assumptions

- **Auth flow:** Email/password + Google OAuth via NextAuth.js
- **API Style:** Server Actions for mutations, API Routes for webhooks
- **Validation:** Zod (schema validation shared client/server)
- **Forms:** React Hook Form + Zod
- **State Management:** React Context + URL state (nuqs); no Redux
- **Logging:** Vercel Logs + Sentry for error tracking
- **CI/CD:** GitHub Actions → Vercel (auto-deploy on push)
- **i18n:** next-intl for FR/DE
- **Search:** PostgreSQL full-text via Prisma

**Stripe Connect:**

- Account type: Express (simplest onboarding)
- Payment flow: Direct charges with application fee
- Payout schedule: T+7 days after experience completion
- Platform commission: 12% (configurable)

---
