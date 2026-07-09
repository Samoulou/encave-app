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

-- 2) Materialize the eager-generation horizon (42 days) for EVERY
--    published experience's active weekly slots — without this, an
--    experience with no future booking has zero occurrences until the
--    02:00 cron: invisible in date search and sunk by the default
--    next_availability sort for up to a day after deploy. Mirrors
--    generateOccurrences: skips blacked-out dates, additive. CURRENT_DATE
--    is DB-timezone (UTC on Neon) vs Zurich in app code — a one-day edge
--    drift the nightly cron corrects; harmless for a one-shot backfill.
--    EXTRACT(DOW) is 0=Sunday..6=Saturday, same convention as
--    availability_slots."dayOfWeek" (JS getUTCDay).
INSERT INTO "experience_occurrences"
  ("id", "experienceId", "date", "startTime", "status", "source", "createdAt", "updatedAt")
SELECT
  'occ_' || replace(gen_random_uuid()::text, '-', ''),
  s."experienceId", d.day, s."startTime", 'OPEN', 'RECURRING', now(), now()
FROM "availability_slots" s
JOIN "experiences" e ON e."id" = s."experienceId" AND e."status" = 'PUBLISHED'
JOIN "wineries" w ON w."id" = e."wineryId" AND w."status" = 'VERIFIED'
CROSS JOIN LATERAL generate_series(
  CURRENT_DATE::timestamp,
  CURRENT_DATE::timestamp + INTERVAL '41 days',
  INTERVAL '1 day'
) AS d(day)
WHERE s."isActive" = true
  AND EXTRACT(DOW FROM d.day) = s."dayOfWeek"
  AND NOT EXISTS (
    SELECT 1 FROM "blocked_dates" bd
    WHERE bd."experienceId" = s."experienceId" AND bd."date" = d.day
  )
ON CONFLICT ("experienceId", "date", "startTime") DO NOTHING;

-- 3) Attach future bookings to their occurrence (idempotent: only NULLs).
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
