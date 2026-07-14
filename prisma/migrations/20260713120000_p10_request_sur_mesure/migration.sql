-- P-10 (Request / sur-mesure) — additive only.

-- Hidden per-winery holder for sur-mesure request bookings (Option A).
-- DRAFT status already excludes it from every PUBLISHED-gated surface;
-- this flag filters the two winemaker lists that show DRAFT rows.
-- AlterTable
ALTER TABLE "experiences" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false;

-- Offer: agreed event day/time + capability token for the payment link.
-- AlterTable
ALTER TABLE "request_offers" ADD COLUMN     "paymentToken" TEXT,
ADD COLUMN     "scheduledDate" DATE,
ADD COLUMN     "scheduledStartTime" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "request_offers_paymentToken_key" ON "request_offers"("paymentToken");
