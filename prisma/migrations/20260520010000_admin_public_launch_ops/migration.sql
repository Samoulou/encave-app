ALTER TABLE "users" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "suspendedBy" TEXT;
ALTER TABLE "users" ADD COLUMN "suspensionReason" TEXT;

CREATE INDEX "users_suspendedAt_idx" ON "users"("suspendedAt");
