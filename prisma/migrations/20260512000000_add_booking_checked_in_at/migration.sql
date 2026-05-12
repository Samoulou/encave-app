-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "checkedInAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bookings_experienceId_date_timeSlot_status_idx" ON "bookings"("experienceId", "date", "timeSlot", "status");
