-- Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add public_slug column (nullable initially for backfill)
ALTER TABLE "photos" ADD COLUMN "public_slug" VARCHAR(30);

-- Backfill existing photos with random slugs (21 chars, URL-safe)
UPDATE "photos"
SET "public_slug" = substr(replace(replace(encode(gen_random_bytes(16), 'base64'), '+', '-'), '/', '_'), 1, 21)
WHERE "public_slug" IS NULL;

-- Make NOT NULL + add unique constraint
ALTER TABLE "photos" ALTER COLUMN "public_slug" SET NOT NULL;
CREATE UNIQUE INDEX "photos_public_slug_key" ON "photos"("public_slug");
