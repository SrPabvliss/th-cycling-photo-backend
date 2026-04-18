-- Enable pgcrypto for gen_random_bytes (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add public_slug column (nullable initially for backfill)
ALTER TABLE "event_assets" ADD COLUMN "public_slug" VARCHAR(30);

-- Backfill existing assets with random slugs (21 chars, URL-safe)
UPDATE "event_assets"
SET "public_slug" = substr(replace(replace(encode(gen_random_bytes(16), 'base64'), '+', '-'), '/', '_'), 1, 21)
WHERE "public_slug" IS NULL;

-- Make NOT NULL + add unique constraint
ALTER TABLE "event_assets" ALTER COLUMN "public_slug" SET NOT NULL;
CREATE UNIQUE INDEX "event_assets_public_slug_key" ON "event_assets"("public_slug");
