-- Snapshot the cancellation policy the client accepted at booking time.
-- Refund computation must never retro-apply a policy change (P-03 review).
ALTER TABLE "bookings" ADD COLUMN "cancellationPolicy" "CancellationPolicy";
