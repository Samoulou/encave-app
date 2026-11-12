-- Security lot (pre-launch audit 2026-11-12): better-auth 1.4 → 1.7.
-- The twoFactor plugin now stores three more columns; better-auth validates
-- the schema at runtime and rejects every /api/auth request when they are
-- missing. Additive and idempotent — no existing column or row is touched
-- beyond the defaults: rows enrolled before 1.7 are verified secrets
-- (default true) with a zero failure counter.
ALTER TABLE "two_factors" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN DEFAULT true;
ALTER TABLE "two_factors" ADD COLUMN IF NOT EXISTS "failedVerificationCount" INTEGER DEFAULT 0;
ALTER TABLE "two_factors" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
