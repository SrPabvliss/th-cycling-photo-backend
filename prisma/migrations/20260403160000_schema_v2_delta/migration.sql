-- CreateEnum
CREATE TYPE "order_item_delivered_as" AS ENUM ('original', 'retouched');

-- AlterEnum: add 'customer' to role_type
ALTER TYPE "role_type" ADD VALUE 'customer';

-- ═══ Modified tables ════════════════════════════════════════════════════════

-- Province: country_id nullable → NOT NULL (data already migrated in TTV-93)
UPDATE "provinces" SET "country_id" = (SELECT "id" FROM "countries" WHERE "iso_code" = 'EC') WHERE "country_id" IS NULL;
ALTER TABLE "provinces" ALTER COLUMN "country_id" SET NOT NULL;

-- Canton: unique constraint on (name, province_id)
CREATE UNIQUE INDEX "cantons_name_province_id_key" ON "cantons"("name", "province_id");

-- RefreshToken: observability fields
ALTER TABLE "refresh_tokens" ADD COLUMN "ip_address" VARCHAR(45),
ADD COLUMN "user_agent" VARCHAR(500);

-- ProcessingJob: metadata jsonb
ALTER TABLE "processing_jobs" ADD COLUMN "metadata" JSONB;

-- DeliveryLink: abuse detection
ALTER TABLE "delivery_links" ADD COLUMN "last_downloaded_at" TIMESTAMPTZ;

-- PlateNumber: number Int → String
ALTER TABLE "plate_numbers" ALTER COLUMN "number" SET DATA TYPE VARCHAR(20) USING "number"::text;

-- ═══ Order modifications ════════════════════════════════════════════════════

-- Order: new columns
ALTER TABLE "orders" ADD COLUMN "user_id" UUID,
ADD COLUMN "subtotal" DECIMAL(10,2),
ADD COLUMN "snap_first_name" VARCHAR(100),
ADD COLUMN "snap_last_name" VARCHAR(100),
ADD COLUMN "snap_email" VARCHAR(255),
ADD COLUMN "snap_phone" VARCHAR(20),
ADD COLUMN "snap_country_id" INTEGER,
ADD COLUMN "snap_province_id" INTEGER,
ADD COLUMN "snap_canton_id" INTEGER,
ADD COLUMN "snap_rider_category" "rider_category";

-- Order: preview_link_id nullable
ALTER TABLE "orders" ALTER COLUMN "preview_link_id" DROP NOT NULL;

-- Order: bib_number Int → String
ALTER TABLE "orders" ALTER COLUMN "bib_number" SET DATA TYPE VARCHAR(20) USING "bib_number"::text;

-- Order: new FK + indexes
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");
CREATE INDEX "idx_order_user_date" ON "orders"("user_id", "created_at" DESC);
CREATE INDEX "idx_order_event_date" ON "orders"("event_id", "created_at" DESC);

-- ═══ OrderPhoto → OrderItem (rename + add columns) ═════════════════════════

-- Rename table preserving data
ALTER TABLE "order_photos" RENAME TO "order_items";

-- Rename constraints
ALTER INDEX "order_photos_pkey" RENAME TO "order_items_pkey";
ALTER INDEX "order_photos_order_id_photo_id_key" RENAME TO "order_items_order_id_photo_id_key";
ALTER INDEX "order_photos_order_id_idx" RENAME TO "order_items_order_id_idx";
ALTER INDEX "order_photos_photo_id_idx" RENAME TO "order_items_photo_id_idx";

-- Rename FK constraints
ALTER TABLE "order_items" RENAME CONSTRAINT "order_photos_order_id_fkey" TO "order_items_order_id_fkey";
ALTER TABLE "order_items" RENAME CONSTRAINT "order_photos_photo_id_fkey" TO "order_items_photo_id_fkey";

-- Add new columns
ALTER TABLE "order_items" ADD COLUMN "unit_price" DECIMAL(10,2),
ADD COLUMN "delivered_as" "order_item_delivered_as";

-- ═══ New tables ═════════════════════════════════════════════════════════════

-- UserPhone
CREATE TABLE "user_phones" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "label" VARCHAR(50),
    "is_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_phones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_phones_user_id_idx" ON "user_phones"("user_id");
ALTER TABLE "user_phones" ADD CONSTRAINT "user_phones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique partial index: only one primary phone per user
CREATE UNIQUE INDEX "idx_user_primary_phone" ON "user_phones" ("user_id") WHERE "is_primary" = true;

-- CustomerProfile
CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "country_id" INTEGER NOT NULL,
    "province_id" INTEGER,
    "canton_id" INTEGER,
    "rider_category" "rider_category" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");
CREATE INDEX "customer_profiles_user_id_idx" ON "customer_profiles"("user_id");
CREATE INDEX "customer_profiles_country_id_idx" ON "customer_profiles"("country_id");
CREATE INDEX "customer_profiles_province_id_idx" ON "customer_profiles"("province_id");
CREATE INDEX "customer_profiles_canton_id_idx" ON "customer_profiles"("canton_id");

ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_canton_id_fkey" FOREIGN KEY ("canton_id") REFERENCES "cantons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
