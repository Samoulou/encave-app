-- P-11 (Événements collectifs) — additive only.
-- L-100: optional per-event logo for a participating winery, shown on the
-- public collective-event fiche grid. Nullable — the render falls back to
-- Winery.coverPhoto when unset. Inert until the COLLECTIVE_EVENTS flag is ON.

-- AlterTable
ALTER TABLE "event_participants" ADD COLUMN     "logo" TEXT;
