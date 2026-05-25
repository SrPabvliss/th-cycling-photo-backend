-- 1. Add new columns nullable so the backfill can succeed
ALTER TABLE "events"
  ADD COLUMN "start_date" DATE,
  ADD COLUMN "end_date"   DATE;

-- 2. Backfill from the old single-day column
UPDATE "events"
SET "start_date" = "event_date",
    "end_date"   = "event_date";

-- 3. Enforce NOT NULL after backfill
ALTER TABLE "events"
  ALTER COLUMN "start_date" SET NOT NULL,
  ALTER COLUMN "end_date"   SET NOT NULL;

-- 4. Drop legacy column + the columns we no longer expose
DROP INDEX IF EXISTS "events_event_date_idx";
ALTER TABLE "events"
  DROP COLUMN "event_date",
  DROP COLUMN "description",
  DROP COLUMN "is_featured";

-- 5. Indexes for the new sort columns
CREATE INDEX "events_start_date_idx" ON "events" ("start_date" DESC);
CREATE INDEX "events_end_date_idx"   ON "events" ("end_date" DESC);
