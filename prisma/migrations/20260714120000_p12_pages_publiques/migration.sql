-- P-12 pages publiques & légal — additive only.
-- L-117: public winery-fiche enrichment (opening hours + identity chips),
-- all optional, edited in the encaveur settings, displayed only when filled.
-- L-112: legal audit trail — timestamp of the CGV + cancellation-policy
-- acceptance checkbox at checkout. These columns are inert until wired ON.

ALTER TABLE "wineries"
  ADD COLUMN "openingHours" TEXT,
  ADD COLUMN "altitude" INTEGER,
  ADD COLUMN "hectares" DOUBLE PRECISION,
  ADD COLUMN "familyName" TEXT,
  ADD COLUMN "signatureGrapes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "bookings"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
