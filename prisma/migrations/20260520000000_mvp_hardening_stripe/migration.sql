ALTER TABLE "bookings" ADD COLUMN "stripeCheckoutSessionId" TEXT;

UPDATE "bookings"
SET "stripeCheckoutSessionId" = "stripePaymentIntentId"
WHERE "stripePaymentIntentId" LIKE 'cs_%';

UPDATE "bookings"
SET "stripePaymentIntentId" = NULL
WHERE "stripePaymentIntentId" LIKE 'cs_%';

CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_events_stripeEventId_key" ON "stripe_events"("stripeEventId");
CREATE INDEX "bookings_stripeCheckoutSessionId_idx" ON "bookings"("stripeCheckoutSessionId");
CREATE INDEX "bookings_stripePaymentIntentId_idx" ON "bookings"("stripePaymentIntentId");
CREATE INDEX "stripe_events_type_createdAt_idx" ON "stripe_events"("type", "createdAt");
CREATE INDEX "stripe_events_status_createdAt_idx" ON "stripe_events"("status", "createdAt");
