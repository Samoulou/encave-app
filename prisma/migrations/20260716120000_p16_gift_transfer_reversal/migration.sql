-- P-16 (WS-A.3, ADR-0003): durable guard for the winery-transfer reversal
-- issued when a gift-funded CONFIRMED booking is cancelled. Additive only.
ALTER TABLE "bookings" ADD COLUMN "giftTransferReversalId" TEXT;
