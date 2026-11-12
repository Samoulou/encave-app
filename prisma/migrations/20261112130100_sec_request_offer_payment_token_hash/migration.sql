-- Security lot (pre-launch audit 2026-11-12): hash-at-rest for the
-- sur-mesure offer payment-link token. Additive and idempotent: one
-- nullable column + its unique index. Existing rows keep paymentTokenHash
-- NULL and are still resolved through the legacy plaintext column until
-- they expire (offers live a few days); nothing is rewritten or dropped.
ALTER TABLE "request_offers" ADD COLUMN IF NOT EXISTS "paymentTokenHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "request_offers_paymentTokenHash_key" ON "request_offers"("paymentTokenHash");
