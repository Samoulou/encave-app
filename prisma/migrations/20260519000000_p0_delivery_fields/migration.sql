ALTER TABLE "users" ADD COLUMN "cookieConsent" JSONB;
ALTER TABLE "users" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

ALTER TABLE "bookings" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "bookings" ADD COLUMN "refundError" TEXT;
ALTER TABLE "bookings" ADD COLUMN "ageConfirmedAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN "ageConfirmedVersion" TEXT;

CREATE TABLE "admin_actions" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_actions_adminId_createdAt_idx" ON "admin_actions"("adminId", "createdAt");
CREATE INDEX "admin_actions_targetType_targetId_idx" ON "admin_actions"("targetType", "targetId");
CREATE INDEX "admin_actions_action_createdAt_idx" ON "admin_actions"("action", "createdAt");
