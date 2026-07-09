-- P-05 soft data migration (ADR-0002 §7, decision D4/D-C). Pure DML,
-- additive, replayable. Because seat COUNTING stays on
-- (experienceId, date, timeSlot), this backfill is a calendar/UX
-- convenience — NOT a capacity-correctness dependency.

-- 1) Materialize an OPEN occurrence for every FUTURE slot that carries a
--    live booking. gen_random_uuid: ids are String without format
--    constraint; the occ_ prefix marks backfilled rows (cosmetic).
INSERT INTO "experience_occurrences"
  ("id", "experienceId", "date", "startTime", "status", "source", "createdAt", "updatedAt")
SELECT
  'occ_' || replace(gen_random_uuid()::text, '-', ''),
  s."experienceId", s."date", s."timeSlot", 'OPEN', 'RECURRING', now(), now()
FROM (
  SELECT DISTINCT b."experienceId", b."date", b."timeSlot"
  FROM "bookings" b
  WHERE b."date" >= CURRENT_DATE
    AND b."status" IN ('CONFIRMED', 'PENDING_PAYMENT')
) s
ON CONFLICT ("experienceId", "date", "startTime") DO NOTHING;

-- 2) Attach future bookings to their occurrence (idempotent: only NULLs).
--    Past bookings stay NULL by decision D-C (no capacity impact; the
--    owner calendar groups by COALESCE(occurrence, (date, timeSlot))).
UPDATE "bookings" b
SET "occurrenceId" = o."id"
FROM "experience_occurrences" o
WHERE b."occurrenceId" IS NULL
  AND b."date" >= CURRENT_DATE
  AND o."experienceId" = b."experienceId"
  AND o."date"         = b."date"
  AND o."startTime"    = b."timeSlot";
