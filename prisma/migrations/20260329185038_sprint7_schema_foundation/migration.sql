-- CreateEnum
CREATE TYPE "event_asset_type" AS ENUM ('cover_image', 'event_logo', 'hero_image', 'poster');

-- CreateEnum
CREATE TYPE "rider_category" AS ENUM ('pre_infantil', 'infantil', 'pre_juvenil', 'juvenil', 'damas_abiertas', 'damas_elite', 'novatos_dobles', 'novatos_rigidos', 'master_a', 'master_b', 'master_c', 'e_bike', 'enduro_a', 'enduro_b', 'rigidas', 'elite', 'pro_elite');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "canton_id" INTEGER,
ADD COLUMN     "country_id" INTEGER,
ADD COLUMN     "province_id" INTEGER,
ADD COLUMN     "rider_category" "rider_category";

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "bib_number" INTEGER;

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "photo_category_id" UUID;

-- CreateTable
CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "iso_code" VARCHAR(2) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_assets" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "asset_type" "event_asset_type" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_size" BIGINT,
    "mime_type" VARCHAR(50),
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_photo_categories" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_photo_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_code_key" ON "countries"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "event_assets_storage_key_key" ON "event_assets"("storage_key");

-- CreateIndex
CREATE INDEX "event_assets_event_id_idx" ON "event_assets"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_assets_event_id_asset_type_key" ON "event_assets"("event_id", "asset_type");

-- CreateIndex
CREATE INDEX "event_photo_categories_event_id_idx" ON "event_photo_categories"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_photo_categories_event_id_name_key" ON "event_photo_categories"("event_id", "name");

-- CreateIndex
CREATE INDEX "customers_country_id_idx" ON "customers"("country_id");

-- CreateIndex
CREATE INDEX "customers_province_id_idx" ON "customers"("province_id");

-- CreateIndex
CREATE INDEX "customers_canton_id_idx" ON "customers"("canton_id");

-- CreateIndex
CREATE INDEX "photos_photo_category_id_idx" ON "photos"("photo_category_id");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_photo_category_id_fkey" FOREIGN KEY ("photo_category_id") REFERENCES "event_photo_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_canton_id_fkey" FOREIGN KEY ("canton_id") REFERENCES "cantons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assets" ADD CONSTRAINT "event_assets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_photo_categories" ADD CONSTRAINT "event_photo_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: copy existing cover_image data into EventAsset
INSERT INTO "event_assets" ("id", "event_id", "asset_type", "storage_key", "uploaded_at")
SELECT gen_random_uuid(), "id", 'cover_image', "cover_image_storage_key", now()
FROM "events"
WHERE "cover_image_storage_key" IS NOT NULL;
