-- P-09 gift-card redemption at checkout (additive).
-- giftCardId + giftAppliedCents are stamped when the gift is reserved at
-- session creation; giftTransferId records the platform->winery transfer
-- written once at confirmation (idempotency guard against double transfer).
ALTER TABLE "bookings" ADD COLUMN "giftCardId" TEXT;
ALTER TABLE "bookings" ADD COLUMN "giftAppliedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "giftTransferId" TEXT;

-- Reconciliation cron target: CONFIRMED bookings whose gift transfer has
-- not landed yet (giftAppliedCents > 0 AND giftTransferId IS NULL).
CREATE INDEX "bookings_giftAppliedCents_giftTransferId_idx"
  ON "bookings"("giftAppliedCents", "giftTransferId");
