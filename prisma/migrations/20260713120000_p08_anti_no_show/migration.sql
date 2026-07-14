-- P-08 anti no-show (US-220) — additive only.
-- Introduces the ON_SITE / free experience payment mode and the per-booking
-- card imprint + manual off-session no-show charge. Flag NO_SHOW_FEES gates
-- all behavior; these columns are inert until the feature is wired ON.

-- Experience payment mode: ONLINE (default, paid at checkout) vs ON_SITE
-- (free / pay-at-the-winery, eligible for a no-show card imprint).
CREATE TYPE "ExperiencePaymentMode" AS ENUM ('ONLINE', 'ON_SITE');

-- State of the manual off-session no-show charge (null = never attempted).
-- PENDING = attempt in flight (CAS guard against a double debit).
CREATE TYPE "NoShowChargeStatus" AS ENUM ('PENDING', 'CHARGED', 'FAILED');

ALTER TABLE "experiences"
  ADD COLUMN "paymentMode" "ExperiencePaymentMode" NOT NULL DEFAULT 'ONLINE';

-- Card imprint (SetupIntent, zero debit) + consent snapshot + charge state.
ALTER TABLE "bookings"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "noShowSetupIntentId" TEXT,
  ADD COLUMN "noShowPaymentMethodId" TEXT,
  ADD COLUMN "noShowPolicyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "noShowPolicyVersion" TEXT,
  ADD COLUMN "noShowFeeCentsSnapshot" INTEGER,
  ADD COLUMN "noShowFeeChargeStatus" "NoShowChargeStatus",
  ADD COLUMN "noShowFeeChargedCents" INTEGER,
  ADD COLUMN "noShowFeeChargePaymentIntentId" TEXT,
  ADD COLUMN "noShowFeeRefundId" TEXT,
  ADD COLUMN "noShowFeeRefundedCents" INTEGER;

-- Payout correlation: the off-session charge's PI id is NOT stripePaymentIntentId.
CREATE INDEX "bookings_noShowFeeChargePaymentIntentId_idx"
  ON "bookings"("noShowFeeChargePaymentIntentId");
