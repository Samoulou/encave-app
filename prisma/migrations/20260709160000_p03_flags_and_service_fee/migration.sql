-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "serviceFeeCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- Money invariant: the client booking fee can never be negative.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_service_fee_non_negative" CHECK ("serviceFeeCents" >= 0);
