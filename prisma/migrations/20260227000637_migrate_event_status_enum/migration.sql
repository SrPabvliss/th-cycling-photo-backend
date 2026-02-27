-- Convert existing data: all non-archived statuses become 'active'
-- (draft, uploading, processing, completed → active)
UPDATE "events" SET "status" = 'draft' WHERE "status" IN ('uploading', 'processing', 'completed');

-- Rename old enum type
ALTER TYPE "event_status" RENAME TO "event_status_old";

-- Create new enum type with only active and archived
CREATE TYPE "event_status" AS ENUM ('active', 'archived');

-- Alter column to use new enum (cast via text)
ALTER TABLE "events"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "event_status" USING (
    CASE
      WHEN "status"::text = 'draft' THEN 'active'::event_status
      ELSE 'active'::event_status
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'active';

-- Drop old enum type
DROP TYPE "event_status_old";
