-- Add public slug for retouched photo versions (same KV pattern as original photos)
ALTER TABLE "photos" ADD COLUMN "retouched_public_slug" VARCHAR(30);

-- Unique constraint (nullable — only set when retouched version exists)
CREATE UNIQUE INDEX "photos_retouched_public_slug_key" ON "photos" ("retouched_public_slug") WHERE "retouched_public_slug" IS NOT NULL;
