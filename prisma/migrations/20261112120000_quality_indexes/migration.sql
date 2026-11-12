-- Quality lot (pre-launch audit 2026-11-12): missing indexes only.
-- Additive, idempotent (IF NOT EXISTS) — no table or column is touched.
-- Names follow Prisma's convention so `prisma migrate diff` stays clean.

-- Public fiche resolves an experience by slug alone; the (wineryId, slug)
-- unique cannot serve that lookup.
CREATE INDEX IF NOT EXISTS "experiences_slug_idx" ON "experiences"("slug");

-- Foreign keys without an index: gallery includes on the public fiches and
-- the `galleryImages: { some: {} }` EXISTS of the winery visibility rule.
CREATE INDEX IF NOT EXISTS "experience_gallery_images_experienceId_idx" ON "experience_gallery_images"("experienceId");
CREATE INDEX IF NOT EXISTS "winery_gallery_images_wineryId_idx" ON "winery_gallery_images"("wineryId");
CREATE INDEX IF NOT EXISTS "verification_logs_wineryId_idx" ON "verification_logs"("wineryId");

-- Admin system-health view (failed emails, newest first) and the retention
-- purge (status + age).
CREATE INDEX IF NOT EXISTS "email_logs_status_createdAt_idx" ON "email_logs"("status", "createdAt");

-- Admin bookings list: ORDER BY "createdAt" DESC LIMIT 100.
CREATE INDEX IF NOT EXISTS "bookings_createdAt_idx" ON "bookings"("createdAt");

-- better-auth lookups (sessions/accounts of a user, verification codes by
-- identifier) and the ON DELETE CASCADE from users.
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("userId");
CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications"("identifier");
