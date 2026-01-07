# EnCave Tech Stack

> **Source:** Extracted and enriched from `docs/architecture.md`
> **Last Updated:** 2026-01-07

This is the **DEFINITIVE** technology selection for EnCave. All development must use these exact technologies and versions.

---

## Quick Reference

| Layer    | Primary Technology                  |
| -------- | ----------------------------------- |
| Frontend | Next.js 14+ (App Router, RSC)       |
| Backend  | Next.js Server Actions + API Routes |
| Database | PostgreSQL 16 (Neon)                |
| ORM      | Prisma 5.x                          |
| Auth     | NextAuth.js v5                      |
| Payments | Stripe Connect                      |
| Hosting  | Vercel                              |

---

## Complete Technology Matrix

### Frontend

| Technology      | Version | Purpose                      | Documentation                                                  |
| --------------- | ------- | ---------------------------- | -------------------------------------------------------------- |
| TypeScript      | 5.3+    | Type-safe development        | [typescriptlang.org](https://www.typescriptlang.org/docs/)     |
| Next.js         | 14.2+   | Full-stack React framework   | [nextjs.org/docs](https://nextjs.org/docs)                     |
| React           | 18+     | UI library                   | [react.dev](https://react.dev)                                 |
| shadcn/ui       | latest  | Accessible UI primitives     | [ui.shadcn.com](https://ui.shadcn.com)                         |
| Tailwind CSS    | 3.4+    | Utility-first styling        | [tailwindcss.com](https://tailwindcss.com/docs)                |
| React Hook Form | 7.x     | Form state management        | [react-hook-form.com](https://react-hook-form.com)             |
| Zod             | 3.x     | Schema validation            | [zod.dev](https://zod.dev)                                     |
| nuqs            | 1.x     | Type-safe URL state          | [nuqs.47ng.com](https://nuqs.47ng.com)                         |
| next-intl       | 3.x     | Internationalization (FR/DE) | [next-intl-docs.vercel.app](https://next-intl-docs.vercel.app) |

### Backend

| Technology            | Version     | Purpose                | Documentation                                                                                                                                                    |
| --------------------- | ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js API Routes    | 14.2+       | Webhook endpoints only | [nextjs.org/docs/app/api-reference](https://nextjs.org/docs/app/api-reference)                                                                                   |
| Server Actions        | Next.js 14+ | Type-safe mutations    | [nextjs.org/docs/app/building-your-application/data-fetching/server-actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions) |
| Prisma                | 5.x         | Type-safe ORM          | [prisma.io/docs](https://www.prisma.io/docs)                                                                                                                     |
| NextAuth.js (Auth.js) | 5.x         | Authentication         | [authjs.dev](https://authjs.dev)                                                                                                                                 |

### Database & Storage

| Technology        | Version | Purpose                     | Documentation                                                                      |
| ----------------- | ------- | --------------------------- | ---------------------------------------------------------------------------------- |
| PostgreSQL        | 16      | Primary data store          | [postgresql.org/docs](https://www.postgresql.org/docs/)                            |
| Neon              | -       | Serverless Postgres hosting | [neon.tech/docs](https://neon.tech/docs)                                           |
| Vercel Blob       | -       | Image/file storage          | [vercel.com/docs/storage/vercel-blob](https://vercel.com/docs/storage/vercel-blob) |
| Vercel Data Cache | -       | RSC caching                 | Built into Next.js                                                                 |

### External Services

| Service        | Purpose              | Documentation                                                            |
| -------------- | -------------------- | ------------------------------------------------------------------------ |
| Stripe Connect | Marketplace payments | [stripe.com/docs/connect](https://stripe.com/docs/connect)               |
| Resend         | Transactional emails | [resend.com/docs](https://resend.com/docs)                               |
| Google OAuth   | Social login         | [developers.google.com/identity](https://developers.google.com/identity) |

### Testing

| Technology            | Version | Purpose                  | Documentation                                                                              |
| --------------------- | ------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| Vitest                | 1.x     | Unit & integration tests | [vitest.dev](https://vitest.dev)                                                           |
| React Testing Library | 14+     | Component testing        | [testing-library.com/react](https://testing-library.com/docs/react-testing-library/intro/) |
| Playwright            | 1.40+   | E2E tests (Phase 2)      | [playwright.dev](https://playwright.dev)                                                   |

### DevOps & Monitoring

| Technology       | Purpose                | Documentation                                                                                                   |
| ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Vercel           | Hosting & deployment   | [vercel.com/docs](https://vercel.com/docs)                                                                      |
| GitHub Actions   | CI/CD pipelines        | [docs.github.com/actions](https://docs.github.com/en/actions)                                                   |
| Sentry           | Error tracking         | [docs.sentry.io/platforms/javascript/guides/nextjs](https://docs.sentry.io/platforms/javascript/guides/nextjs/) |
| Vercel Analytics | Performance monitoring | [vercel.com/docs/analytics](https://vercel.com/docs/analytics)                                                  |

---

## Key Architectural Decisions

### 1. NextAuth.js v5 (Auth.js)

**Decision:** Use NextAuth.js v5 over v4

**Rationale:**

- Better App Router support
- Edge runtime compatibility
- Simplified configuration
- Future-proof with Auth.js rebranding

### 2. nuqs for URL State

**Decision:** Use nuqs for search parameter management

**Rationale:**

- Type-safe URL search params
- Shareable search URLs (SEO benefit)
- Seamless integration with App Router
- No global state management overhead

### 3. No Redis Cache (MVP)

**Decision:** Use Vercel's built-in Data Cache instead of external Redis

**Rationale:**

- Sufficient for MVP traffic
- Zero configuration overhead
- Cost savings
- Can migrate to Redis later if needed

### 4. Sentry over Vercel Error Tracking

**Decision:** Use Sentry for error monitoring

**Rationale:**

- More detailed error context
- Better source map support
- Richer debugging tools
- Industry standard

### 5. Turbopack for Dev Only

**Decision:** Use Turbopack in development, Webpack in production

**Rationale:**

- Turbopack: Faster development experience
- Webpack: More stable production builds
- Automatic via Next.js configuration

### 6. Server Actions over REST

**Decision:** Use Server Actions for all mutations, API Routes only for webhooks

**Rationale:**

- Type-safe end-to-end
- No API versioning overhead
- Reduced boilerplate
- Built into Next.js

---

## Version Pinning Strategy

```json
// package.json - Use exact versions for critical dependencies
{
  "dependencies": {
    "next": "14.2.x",
    "react": "18.x",
    "@prisma/client": "5.x",
    "next-auth": "5.x",
    "stripe": "14.x",
    "zod": "3.x"
  }
}
```

**Rules:**

- Pin major.minor for framework dependencies
- Allow patch updates for security fixes
- Lock exact versions before major releases
- Document breaking changes in CHANGELOG

---

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/encave

# Authentication
NEXTAUTH_SECRET=your-32-char-secret-minimum
NEXTAUTH_URL=https://encave.ch
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email
RESEND_API_KEY=re_xxx

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx
```

### Environment-Specific

| Variable            | Development           | Staging                   | Production        |
| ------------------- | --------------------- | ------------------------- | ----------------- |
| `NEXTAUTH_URL`      | http://localhost:3000 | https://staging.encave.ch | https://encave.ch |
| `STRIPE_SECRET_KEY` | sk_test_xxx           | sk_test_xxx               | sk_live_xxx       |
| `DATABASE_URL`      | Local/Neon branch     | Neon staging              | Neon main         |

---

## Package Installation Commands

```bash
# Core framework
npx create-next-app@latest encave --typescript --tailwind --eslint --app

# UI & Styling
npx shadcn-ui@latest init
npm install tailwind-merge clsx

# Forms & Validation
npm install react-hook-form zod @hookform/resolvers

# Database
npm install prisma @prisma/client
npx prisma init

# Authentication
npm install next-auth@beta @auth/prisma-adapter

# Payments
npm install stripe @stripe/stripe-js

# i18n
npm install next-intl

# URL State
npm install nuqs

# Email
npm install resend react-email @react-email/components

# Storage
npm install @vercel/blob

# Testing
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D playwright @playwright/test

# Monitoring
npm install @sentry/nextjs

# Development
npm install -D prettier eslint-config-prettier
```

---

## Compatibility Notes

### Node.js

- Minimum: Node.js 18.17+
- Recommended: Node.js 20 LTS

### Browsers

- Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- No IE11 support required

### Mobile

- iOS Safari 15+
- Chrome for Android 100+

---

_Reference: Full architecture at `docs/architecture.md`_
