-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('ENCAVE', 'GETYOURGUIDE', 'VIATOR', 'AIRBNB', 'OTHER');

-- CreateEnum
CREATE TYPE "ChannelConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ChannelCapability" AS ENUM ('LISTINGS', 'AVAILABILITY', 'BOOKINGS', 'CANCELLATIONS', 'PRICING');

-- CreateEnum
CREATE TYPE "ChannelDistributionMode" AS ENUM ('IMPORT_ONLY', 'EXPORT_ONLY', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "ChannelPublicationStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "ChannelCapacityMode" AS ENUM ('SHARED', 'ALLOCATED');

-- CreateEnum
CREATE TYPE "MerchantOfRecord" AS ENUM ('ENCAVE', 'CHANNEL', 'WINERY');

-- CreateEnum
CREATE TYPE "ChannelInboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ChannelOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChannelIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "channelConnectionId" TEXT,
ADD COLUMN     "channelImportBatchId" TEXT,
ADD COLUMN     "channelListingId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "externalBookingId" TEXT,
ADD COLUMN     "externalBookingReference" TEXT,
ADD COLUMN     "externalCommissionAmount" INTEGER,
ADD COLUMN     "externalCreatedAt" TIMESTAMP(3),
ADD COLUMN     "externalCurrency" TEXT,
ADD COLUMN     "externalGrossAmount" INTEGER,
ADD COLUMN     "externalNetAmount" INTEGER,
ADD COLUMN     "externalStatus" TEXT,
ADD COLUMN     "externalUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "merchantOfRecord" "MerchantOfRecord" NOT NULL DEFAULT 'ENCAVE',
ADD COLUMN     "salesAttribution" "ChannelType",
ADD COLUMN     "sourceChannel" "ChannelType" NOT NULL DEFAULT 'ENCAVE';

-- CreateTable
CREATE TABLE "channel_connections" (
    "id" TEXT NOT NULL,
    "wineryId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "capabilities" "ChannelCapability"[] DEFAULT ARRAY[]::"ChannelCapability"[],
    "distributionMode" "ChannelDistributionMode" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "externalAccountId" TEXT,
    "credentials" JSONB,
    "settings" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_listings" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "externalOptionId" TEXT,
    "publicationStatus" "ChannelPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "capacityMode" "ChannelCapacityMode" NOT NULL DEFAULT 'SHARED',
    "capacityQuota" INTEGER,
    "metadata" JSONB,
    "publishedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_inbox_events" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ChannelInboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_inbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_outbox_events" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "channelListingId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ChannelOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_sync_runs" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "direction" "ChannelDistributionMode" NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_sync_issues" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "channelSyncRunId" TEXT,
    "channelListingId" TEXT,
    "status" "ChannelIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_sync_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_import_batches" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "sourceFilename" TEXT,
    "status" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errorReport" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_connections_wineryId_status_idx" ON "channel_connections"("wineryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "channel_connections_wineryId_channel_externalAccountId_key" ON "channel_connections"("wineryId", "channel", "externalAccountId");

-- CreateIndex
CREATE INDEX "channel_listings_experienceId_idx" ON "channel_listings"("experienceId");

-- CreateIndex
CREATE INDEX "channel_listings_channelConnectionId_publicationStatus_idx" ON "channel_listings"("channelConnectionId", "publicationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "channel_listings_channelConnectionId_experienceId_key" ON "channel_listings"("channelConnectionId", "experienceId");

-- CreateIndex
-- NULL is a real option identifier here (the channel product has no variants),
-- so two mappings with a NULL option must not evade the unique constraint.
CREATE UNIQUE INDEX "channel_listings_channelConnectionId_externalProductId_exte_key" ON "channel_listings"("channelConnectionId", "externalProductId", "externalOptionId") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "channel_inbox_events_status_receivedAt_idx" ON "channel_inbox_events"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "channel_inbox_events_channelConnectionId_externalEventId_key" ON "channel_inbox_events"("channelConnectionId", "externalEventId");

-- CreateIndex
CREATE INDEX "channel_outbox_events_status_availableAt_idx" ON "channel_outbox_events"("status", "availableAt");

-- CreateIndex
CREATE INDEX "channel_outbox_events_channelConnectionId_idx" ON "channel_outbox_events"("channelConnectionId");

-- CreateIndex
CREATE INDEX "channel_sync_runs_channelConnectionId_startedAt_idx" ON "channel_sync_runs"("channelConnectionId", "startedAt");

-- CreateIndex
CREATE INDEX "channel_sync_issues_channelConnectionId_status_idx" ON "channel_sync_issues"("channelConnectionId", "status");

-- CreateIndex
CREATE INDEX "channel_sync_issues_channelSyncRunId_idx" ON "channel_sync_issues"("channelSyncRunId");

-- CreateIndex
CREATE INDEX "channel_import_batches_channelConnectionId_createdAt_idx" ON "channel_import_batches"("channelConnectionId", "createdAt");

-- CreateIndex
CREATE INDEX "bookings_channelConnectionId_idx" ON "bookings"("channelConnectionId");

-- CreateIndex
CREATE INDEX "bookings_channelListingId_idx" ON "bookings"("channelListingId");

-- CreateIndex
CREATE INDEX "bookings_channelImportBatchId_idx" ON "bookings"("channelImportBatchId");

-- CreateIndex
CREATE INDEX "bookings_createdById_idx" ON "bookings"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_channelConnectionId_externalBookingId_key" ON "bookings"("channelConnectionId", "externalBookingId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "channel_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_channelListingId_fkey" FOREIGN KEY ("channelListingId") REFERENCES "channel_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_channelImportBatchId_fkey" FOREIGN KEY ("channelImportBatchId") REFERENCES "channel_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_wineryId_fkey" FOREIGN KEY ("wineryId") REFERENCES "wineries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_inbox_events" ADD CONSTRAINT "channel_inbox_events_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_outbox_events" ADD CONSTRAINT "channel_outbox_events_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_outbox_events" ADD CONSTRAINT "channel_outbox_events_channelListingId_fkey" FOREIGN KEY ("channelListingId") REFERENCES "channel_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_runs" ADD CONSTRAINT "channel_sync_runs_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_issues" ADD CONSTRAINT "channel_sync_issues_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_issues" ADD CONSTRAINT "channel_sync_issues_channelSyncRunId_fkey" FOREIGN KEY ("channelSyncRunId") REFERENCES "channel_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_issues" ADD CONSTRAINT "channel_sync_issues_channelListingId_fkey" FOREIGN KEY ("channelListingId") REFERENCES "channel_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_import_batches" ADD CONSTRAINT "channel_import_batches_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Worker counters, monetary snapshots and allocated inventory are quantities.
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_capacity_quota_non_negative"
  CHECK ("capacityQuota" IS NULL OR "capacityQuota" >= 0);
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_capacity_mode_coherent"
  CHECK (("capacityMode" = 'SHARED' AND "capacityQuota" IS NULL) OR
         ("capacityMode" = 'ALLOCATED' AND "capacityQuota" IS NOT NULL));
ALTER TABLE "channel_inbox_events" ADD CONSTRAINT "channel_inbox_events_attempts_non_negative"
  CHECK ("attempts" >= 0);
ALTER TABLE "channel_outbox_events" ADD CONSTRAINT "channel_outbox_events_attempts_non_negative"
  CHECK ("attempts" >= 0);
ALTER TABLE "channel_sync_runs" ADD CONSTRAINT "channel_sync_runs_counts_non_negative"
  CHECK ("recordsProcessed" >= 0 AND "recordsFailed" >= 0);
ALTER TABLE "channel_import_batches" ADD CONSTRAINT "channel_import_batches_counts_non_negative"
  CHECK ("totalRows" >= 0 AND "importedRows" >= 0 AND "failedRows" >= 0 AND
         "importedRows" + "failedRows" <= "totalRows");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_external_amounts_non_negative"
  CHECK (("externalGrossAmount" IS NULL OR "externalGrossAmount" >= 0) AND
         ("externalCommissionAmount" IS NULL OR "externalCommissionAmount" >= 0) AND
         ("externalNetAmount" IS NULL OR "externalNetAmount" >= 0));
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_external_amounts_coherent"
  CHECK (("externalGrossAmount" IS NULL AND "externalCommissionAmount" IS NULL AND "externalNetAmount" IS NULL AND "externalCurrency" IS NULL) OR
         ("externalGrossAmount" IS NOT NULL AND "externalCommissionAmount" IS NOT NULL AND "externalNetAmount" IS NOT NULL AND
          "externalCurrency" IS NOT NULL AND char_length("externalCurrency") = 3 AND
          "externalGrossAmount" = "externalCommissionAmount" + "externalNetAmount"));
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_external_source_coherent"
  CHECK (("sourceChannel" = 'ENCAVE' AND "channelConnectionId" IS NULL AND "channelListingId" IS NULL AND
          "externalBookingId" IS NULL AND "externalBookingReference" IS NULL AND "externalStatus" IS NULL AND
          "externalCreatedAt" IS NULL AND "externalUpdatedAt" IS NULL AND "channelImportBatchId" IS NULL AND
          "externalGrossAmount" IS NULL AND "merchantOfRecord" = 'ENCAVE') OR
         ("sourceChannel" <> 'ENCAVE' AND "externalBookingId" IS NOT NULL));

-- A listing can only expose an experience owned by the connection's winery.
-- The same guard prevents a channel booking from crossing winery boundaries.
CREATE FUNCTION enforce_channel_winery_isolation() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'channel_listings' AND NOT EXISTS (
    SELECT 1 FROM "channel_connections" c JOIN "experiences" e ON e."wineryId" = c."wineryId"
    WHERE c.id = NEW."channelConnectionId" AND e.id = NEW."experienceId"
  ) THEN
    RAISE EXCEPTION 'channel listing must belong to one winery' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'bookings' AND NEW."channelConnectionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "channel_connections" c WHERE c.id = NEW."channelConnectionId" AND c."wineryId" = NEW."wineryId"
  ) THEN
    RAISE EXCEPTION 'channel booking must belong to one winery' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'bookings' AND NEW."channelListingId" IS NOT NULL AND NEW."channelConnectionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "channel_listings" l
    WHERE l.id = NEW."channelListingId" AND l."channelConnectionId" = NEW."channelConnectionId" AND l."experienceId" = NEW."experienceId"
  ) THEN
    RAISE EXCEPTION 'channel booking listing is inconsistent' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER channel_listings_winery_isolation
  BEFORE INSERT OR UPDATE ON "channel_listings" FOR EACH ROW EXECUTE FUNCTION enforce_channel_winery_isolation();
CREATE TRIGGER bookings_channel_winery_isolation
  BEFORE INSERT OR UPDATE ON "bookings" FOR EACH ROW EXECUTE FUNCTION enforce_channel_winery_isolation();
