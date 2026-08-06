-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "bookings_wineryId_status_date_idx" ON "bookings"("wineryId", "status", "date");

-- CreateIndex
CREATE INDEX "bookings_status_date_idx" ON "bookings"("status", "date");

-- CreateIndex
CREATE INDEX "bookings_visitor_email_trgm_idx" ON "bookings" USING GIN ("visitorEmail" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "experiences_title_trgm_idx" ON "experiences" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "experiences_description_trgm_idx" ON "experiences" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "wineries_name_trgm_idx" ON "wineries" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "wineries_commune_trgm_idx" ON "wineries" USING GIN ("commune" gin_trgm_ops);
