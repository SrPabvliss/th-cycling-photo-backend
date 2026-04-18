-- Add public-facing slug to events (friendly URL identifier)
ALTER TABLE "events" ADD COLUMN "slug" VARCHAR(250);

-- Backfill: generate slug from name (lowercase, replace non-alphanum with hyphens, trim)
UPDATE "events"
SET "slug" = LOWER(
  TRIM(BOTH '-' FROM
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '[\s-]+', '-', 'g'
    )
  )
);

-- Append short random suffix to any duplicates
WITH dupes AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM "events"
)
UPDATE "events" e
SET slug = e.slug || '-' || SUBSTRING(ENCODE(gen_random_bytes(4), 'hex') FROM 1 FOR 6)
FROM dupes d
WHERE e.id = d.id AND d.rn > 1;

-- Now make it required and unique
ALTER TABLE "events" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "events_slug_key" ON "events" ("slug");
