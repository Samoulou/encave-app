-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'STANDARD', 'STRICT');

-- CreateEnum
CREATE TYPE "WineryPlan" AS ENUM ('FOUNDER', 'STANDARD');

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GiftCardTransactionType" AS ENUM ('PURCHASE', 'REDEMPTION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'OFFERED', 'PAID', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RequestOfferStatus" AS ENUM ('SENT', 'PAID', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExperienceType" ADD VALUE 'MEAL';
ALTER TYPE "ExperienceType" ADD VALUE 'EVENT';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "occurrenceId" TEXT;

-- AlterTable
ALTER TABLE "experiences" ADD COLUMN     "isCollective" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "languages" "Locale"[] DEFAULT ARRAY['FR']::"Locale"[];

-- AlterTable
ALTER TABLE "wineries" ADD COLUMN     "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "commissionRate" DOUBLE PRECISION,
ADD COLUMN     "noShowFeeCents" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "noShowFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plan" "WineryPlan" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "wines" (
    "id" TEXT NOT NULL,
    "wineryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grapeVariety" TEXT NOT NULL,
    "vintage" INTEGER,
    "price" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_wines" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "wineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_wines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "initialAmount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "purchaserEmail" TEXT NOT NULL,
    "purchaserName" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "message" TEXT,
    "experienceId" TEXT,
    "deliverAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "stripePaymentIntentId" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'FR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_transactions" (
    "id" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "type" "GiftCardTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "bookingId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "wineryId" TEXT,
    "clientEmail" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "desiredDate" DATE,
    "guestCount" INTEGER NOT NULL,
    "budget" INTEGER,
    "description" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'FR',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_offers" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "RequestOfferStatus" NOT NULL DEFAULT 'SENT',
    "message" TEXT NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "stripeCheckoutSessionId" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_occurrences" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'OPEN',
    "capacityOverride" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'RECURRING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "wineryId" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wines_wineryId_available_idx" ON "wines"("wineryId", "available");

-- CreateIndex
CREATE INDEX "booking_wines_wineId_idx" ON "booking_wines"("wineId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_wines_bookingId_wineId_key" ON "booking_wines"("bookingId", "wineId");

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_code_key" ON "gift_cards"("code");

-- CreateIndex
CREATE INDEX "gift_cards_status_expiresAt_idx" ON "gift_cards"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "gift_cards_purchaserEmail_idx" ON "gift_cards"("purchaserEmail");

-- CreateIndex
CREATE INDEX "gift_cards_recipientEmail_idx" ON "gift_cards"("recipientEmail");

-- CreateIndex
CREATE INDEX "gift_card_transactions_giftCardId_createdAt_idx" ON "gift_card_transactions"("giftCardId", "createdAt");

-- CreateIndex
CREATE INDEX "gift_card_transactions_bookingId_idx" ON "gift_card_transactions"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "requests_reference_key" ON "requests"("reference");

-- CreateIndex
CREATE INDEX "requests_wineryId_status_idx" ON "requests"("wineryId", "status");

-- CreateIndex
CREATE INDEX "requests_status_createdAt_idx" ON "requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "requests_clientEmail_idx" ON "requests"("clientEmail");

-- CreateIndex
CREATE INDEX "request_offers_requestId_idx" ON "request_offers"("requestId");

-- CreateIndex
CREATE INDEX "request_offers_status_expiresAt_idx" ON "request_offers"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "experience_occurrences_experienceId_date_idx" ON "experience_occurrences"("experienceId", "date");

-- CreateIndex
CREATE INDEX "experience_occurrences_date_status_idx" ON "experience_occurrences"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "experience_occurrences_experienceId_date_startTime_key" ON "experience_occurrences"("experienceId", "date", "startTime");

-- CreateIndex
CREATE INDEX "event_participants_wineryId_idx" ON "event_participants"("wineryId");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_experienceId_wineryId_key" ON "event_participants"("experienceId", "wineryId");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_dedupeKey_key" ON "scheduled_jobs"("dedupeKey");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_runAt_idx" ON "scheduled_jobs"("status", "runAt");

-- CreateIndex
CREATE INDEX "scheduled_jobs_type_status_idx" ON "scheduled_jobs"("type", "status");

-- CreateIndex
CREATE INDEX "bookings_experienceId_idx" ON "bookings"("experienceId");

-- CreateIndex
CREATE INDEX "bookings_wineryId_idx" ON "bookings"("wineryId");

-- CreateIndex
CREATE INDEX "bookings_occurrenceId_idx" ON "bookings"("occurrenceId");

-- CreateIndex
CREATE INDEX "experiences_wineryId_idx" ON "experiences"("wineryId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "experience_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wines" ADD CONSTRAINT "wines_wineryId_fkey" FOREIGN KEY ("wineryId") REFERENCES "wineries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_wines" ADD CONSTRAINT "booking_wines_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_wines" ADD CONSTRAINT "booking_wines_wineId_fkey" FOREIGN KEY ("wineId") REFERENCES "wines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_wineryId_fkey" FOREIGN KEY ("wineryId") REFERENCES "wineries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_offers" ADD CONSTRAINT "request_offers_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_occurrences" ADD CONSTRAINT "experience_occurrences_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_wineryId_fkey" FOREIGN KEY ("wineryId") REFERENCES "wineries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- V3 money invariants (P-02) — enforced at the database level.
-- Prisma cannot express CHECK constraints or triggers; keep these
-- in sync with docs/plans/P-02-schema-v3.md.
-- ============================================================

-- Gift card balance can never go negative, whatever the app does.
ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_balance_non_negative" CHECK ("balance" >= 0);

-- Balance bounds sanity: initial amount is strictly positive.
ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_initial_amount_positive" CHECK ("initialAmount" > 0);

-- The ledger is append-only: no UPDATE, no DELETE, ever.
CREATE OR REPLACE FUNCTION forbid_gift_card_transaction_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'gift_card_transactions is append-only (% forbidden)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gift_card_transactions_append_only
  BEFORE UPDATE OR DELETE ON "gift_card_transactions"
  FOR EACH ROW EXECUTE FUNCTION forbid_gift_card_transaction_mutation();

-- Occurrence capacity override, when set, must be a real capacity.
ALTER TABLE "experience_occurrences"
  ADD CONSTRAINT "experience_occurrences_capacity_override_positive"
  CHECK ("capacityOverride" IS NULL OR "capacityOverride" >= 1);

-- No-show fee is bounded by the product rule (0–50 CHF).
ALTER TABLE "wineries"
  ADD CONSTRAINT "wineries_no_show_fee_bounds" CHECK ("noShowFeeCents" BETWEEN 0 AND 5000);

-- Per-winery commission, when set, is a ratio.
ALTER TABLE "wineries"
  ADD CONSTRAINT "wineries_commission_rate_bounds"
  CHECK ("commissionRate" IS NULL OR ("commissionRate" >= 0 AND "commissionRate" <= 1));

-- Request/offer money sanity.
ALTER TABLE "request_offers"
  ADD CONSTRAINT "request_offers_total_price_positive" CHECK ("totalPrice" > 0);
