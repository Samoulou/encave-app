-- P-05 (ADR-0002): source String -> enum. Additive; the table has zero
-- rows in every environment at this point, so the cast is trivial.
CREATE TYPE "OccurrenceSource" AS ENUM ('RECURRING', 'PUNCTUAL');

ALTER TABLE "experience_occurrences"
  ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "experience_occurrences"
  ALTER COLUMN "source" TYPE "OccurrenceSource" USING ("source"::"OccurrenceSource");
ALTER TABLE "experience_occurrences"
  ALTER COLUMN "source" SET DEFAULT 'RECURRING';
