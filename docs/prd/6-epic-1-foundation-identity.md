# 6. Epic 1: Foundation & Identity

## Epic Goal

Establish project infrastructure, authentication system, and winemaker onboarding - delivering a public page listing verified winemakers as proof of end-to-end functionality.

**Value delivered:** A visitor can browse a directory of verified Valais winemakers; a winemaker can register and await verification.

---

## Story 1.1: Project Foundation & Infrastructure

**As a** developer,
**I want** a fully configured Next.js project with database and deployment pipeline,
**so that** I have a solid foundation to build features upon.

**Acceptance Criteria:**

1. Next.js 14+ project initialized with App Router, TypeScript strict mode, and `src/` directory structure
2. Tailwind CSS configured with a base color palette (burgundy, gold, slate as primaries)
3. shadcn/ui initialized with Button, Input, Card, and Form components
4. PostgreSQL database provisioned (Neon or Supabase) with connection string in environment variables
5. Prisma ORM configured with initial schema containing `User` model (id, email, name, role, createdAt)
6. Environment configuration for development, preview, and production (.env.example documented)
7. GitHub repository created with main branch protection and PR workflow
8. Vercel project connected with automatic deployments on push to main
9. Health check API route (`/api/health`) returns `{ status: "ok", timestamp }` with 200 status
10. Home page displays "EnCave - Coming Soon" with health status indicator
11. ESLint + Prettier configured with consistent code style rules
12. README.md with setup instructions for local development

**Prerequisites:** None

---

## Story 1.2: Authentication System

**As a** user,
**I want** to create an account and log in securely,
**so that** I can access personalized features of the platform.

**Acceptance Criteria:**

1. NextAuth.js (Auth.js) configured with Credentials provider for email/password
2. Prisma schema extended with password hash field and `Account`, `Session` models for NextAuth
3. Password hashing implemented using bcrypt with minimum 10 rounds
4. Login page (`/login`) with email and password fields, validation errors displayed inline
5. Registration page (`/register`) with email, password, confirm password, and name fields
6. Password requirements enforced: minimum 8 characters, at least one number
7. JWT session strategy configured with 7-day expiration
8. Protected route middleware redirects unauthenticated users to `/login`
9. Session accessible in Server Components via `auth()` helper
10. Logout functionality clears session and redirects to home page
11. User role enum created: `CLIENT`, `WINEMAKER`, `ADMIN` (default: `CLIENT`)
12. Auth error messages are user-friendly (no technical jargon)

**Prerequisites:** Story 1.1

---

## Story 1.3: Winemaker Registration Flow

**As a** winemaker,
**I want** to register my winery on the platform,
**so that** I can eventually offer wine experiences to visitors.

**Acceptance Criteria:**

1. Prisma schema extended with `Winery` model: id, name, slug, description, address, commune, phone, email, userId, status, createdAt
2. Winery status enum: `PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`
3. Registration flow extended: after basic signup, winemakers select "I am a winemaker" option
4. Winemaker onboarding form (`/onboarding/winery`) collects: winery name, description (textarea), address, commune (dropdown of Valais communes), contact phone
5. Form validation with Zod schema (name required, description min 50 chars, valid Swiss phone format)
6. On submission, `Winery` record created with status `PENDING`, user role updated to `WINEMAKER`
7. Confirmation page explains verification process and expected timeline
8. User cannot access winemaker features until status is `VERIFIED`
9. Duplicate winery name check with user-friendly error message
10. Winery slug auto-generated from name (URL-safe, unique)

**Prerequisites:** Story 1.2

---

## Story 1.4: Winemaker Profile Management

**As a** verified winemaker,
**I want** to manage my winery's profile and photos,
**so that** visitors see accurate and attractive information.

**Acceptance Criteria:**

1. Winery profile page (`/dashboard/winery/profile`) accessible only to verified winemakers
2. Edit form pre-populated with current winery data
3. Photo upload component supporting JPEG/PNG, max 5MB per image
4. Cover photo field (single image, 16:9 aspect ratio recommended)
5. Gallery photos field (up to 6 images)
6. Images uploaded to Vercel Blob (or Cloudinary) with automatic optimization
7. Image preview shown before and after upload
8. Description field supports basic formatting guidance (plain text for MVP)
9. Changes saved with success toast notification
10. Validation prevents saving incomplete required fields
11. "View public profile" link to preview how visitors will see the winery
12. Last updated timestamp displayed on profile

**Prerequisites:** Story 1.3

---

## Story 1.5: Admin Winemaker Verification

**As a** platform administrator,
**I want** to review and verify pending winemaker registrations,
**so that** only legitimate wineries appear on the platform.

**Acceptance Criteria:**

1. Admin role check middleware for `/admin/*` routes
2. Admin dashboard page (`/admin`) with navigation to verification queue
3. Pending wineries list (`/admin/wineries/pending`) showing: name, commune, registration date, applicant email
4. Winery detail view (`/admin/wineries/[id]`) showing all submitted information
5. "Approve" action sets status to `VERIFIED` and timestamps verification date
6. "Reject" action sets status to `REJECTED` with required reason text field
7. Approved winemakers receive email notification (template: "Your winery has been verified!")
8. Rejected winemakers receive email with rejection reason
9. Filter/sort options: by date, by commune
10. Count badge showing number of pending verifications
11. Verification action logged with admin user ID and timestamp
12. Initial admin user seeded in development database

**Prerequisites:** Story 1.3

---

## Story 1.6: Public Winery Directory

**As a** visitor,
**I want** to browse a list of verified wineries in Valais,
**so that** I can discover winemakers in the region.

**Acceptance Criteria:**

1. Public wineries page (`/wineries`) accessible without authentication
2. Grid layout displaying winery cards (photo, name, commune, short description)
3. Only `VERIFIED` wineries displayed
4. Cards link to individual winery page (`/wineries/[slug]`)
5. Individual winery page shows: cover photo, name, full description, location, contact info
6. Empty state message if no verified wineries yet: "Winemakers coming soon..."
7. Page metadata (title, description) configured for SEO
8. Server-side rendering for optimal SEO and performance
9. Basic commune filter (dropdown) to narrow results
10. Responsive layout: 1 column mobile, 2 columns tablet, 3 columns desktop
11. "Coming soon: Book experiences" teaser on winery detail page
12. Page loads in under 2 seconds (LCP metric)

**Prerequisites:** Story 1.5

---
