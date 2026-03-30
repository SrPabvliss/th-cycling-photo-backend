-- DropForeignKey
ALTER TABLE "photos" DROP CONSTRAINT "photos_photo_category_id_fkey";

-- DropIndex
DROP INDEX "event_photo_categories_event_id_name_key";

-- AlterTable
ALTER TABLE "event_photo_categories" DROP COLUMN "created_at",
DROP COLUMN "name",
ADD COLUMN     "photo_category_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "photo_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "photo_categories_name_key" ON "photo_categories"("name");

-- CreateIndex
CREATE INDEX "event_photo_categories_photo_category_id_idx" ON "event_photo_categories"("photo_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_photo_categories_event_id_photo_category_id_key" ON "event_photo_categories"("event_id", "photo_category_id");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_photo_category_id_fkey" FOREIGN KEY ("photo_category_id") REFERENCES "photo_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_photo_categories" ADD CONSTRAINT "event_photo_categories_photo_category_id_fkey" FOREIGN KEY ("photo_category_id") REFERENCES "photo_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
