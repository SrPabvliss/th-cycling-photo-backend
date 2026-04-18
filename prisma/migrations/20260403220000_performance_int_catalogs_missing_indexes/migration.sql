-- DropForeignKey
ALTER TABLE "customer_profiles" DROP CONSTRAINT "customer_profiles_participant_category_id_fkey";

-- DropForeignKey
ALTER TABLE "event_photo_categories" DROP CONSTRAINT "event_photo_categories_photo_category_id_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_event_type_id_fkey";

-- DropForeignKey
ALTER TABLE "gear_colors" DROP CONSTRAINT "gear_colors_gear_type_id_fkey";

-- DropForeignKey
ALTER TABLE "gear_types" DROP CONSTRAINT "gear_types_event_type_id_fkey";

-- DropForeignKey
ALTER TABLE "participant_categories" DROP CONSTRAINT "participant_categories_event_type_id_fkey";

-- DropForeignKey
ALTER TABLE "photos" DROP CONSTRAINT "photos_photo_category_id_fkey";

-- DropIndex
DROP INDEX "notifications_user_id_created_at_idx";

-- AlterTable
ALTER TABLE "customer_profiles" DROP COLUMN "participant_category_id",
ADD COLUMN     "participant_category_id" INTEGER;

-- AlterTable
ALTER TABLE "event_photo_categories" DROP COLUMN "photo_category_id",
ADD COLUMN     "photo_category_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "event_types" DROP CONSTRAINT "event_types_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "event_types_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "events" DROP COLUMN "event_type_id",
ADD COLUMN     "event_type_id" INTEGER;

-- AlterTable
ALTER TABLE "gear_colors" DROP COLUMN "gear_type_id",
ADD COLUMN     "gear_type_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "gear_types" DROP CONSTRAINT "gear_types_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "event_type_id",
ADD COLUMN     "event_type_id" INTEGER NOT NULL,
ADD CONSTRAINT "gear_types_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "participant_categories" DROP CONSTRAINT "participant_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "event_type_id",
ADD COLUMN     "event_type_id" INTEGER NOT NULL,
ADD CONSTRAINT "participant_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "photo_categories" DROP CONSTRAINT "photo_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "photo_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "photos" DROP COLUMN "photo_category_id",
ADD COLUMN     "photo_category_id" INTEGER;

-- CreateIndex
CREATE INDEX "customer_profiles_participant_category_id_idx" ON "customer_profiles"("participant_category_id");

-- CreateIndex
CREATE INDEX "detected_participants_classified_by_id_idx" ON "detected_participants"("classified_by_id");

-- CreateIndex
CREATE INDEX "event_photo_categories_photo_category_id_idx" ON "event_photo_categories"("photo_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_photo_categories_event_id_photo_category_id_key" ON "event_photo_categories"("event_id", "photo_category_id");

-- CreateIndex
CREATE INDEX "events_event_type_id_idx" ON "events"("event_type_id");

-- CreateIndex
CREATE INDEX "events_updated_by_id_idx" ON "events"("updated_by_id");

-- CreateIndex
CREATE INDEX "gear_colors_gear_type_id_idx" ON "gear_colors"("gear_type_id");

-- CreateIndex
CREATE INDEX "gear_types_event_type_id_idx" ON "gear_types"("event_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "gear_types_name_event_type_id_key" ON "gear_types"("name", "event_type_id");

-- CreateIndex
CREATE INDEX "participant_categories_event_type_id_idx" ON "participant_categories"("event_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_categories_name_event_type_id_key" ON "participant_categories"("name", "event_type_id");

-- CreateIndex
CREATE INDEX "participant_identifiers_corrected_by_id_idx" ON "participant_identifiers"("corrected_by_id");

-- CreateIndex
CREATE INDEX "photos_updated_by_id_idx" ON "photos"("updated_by_id");

-- CreateIndex
CREATE INDEX "photos_photo_category_id_idx" ON "photos"("photo_category_id");

-- AddForeignKey
ALTER TABLE "participant_categories" ADD CONSTRAINT "participant_categories_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_types" ADD CONSTRAINT "gear_types_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_photo_category_id_fkey" FOREIGN KEY ("photo_category_id") REFERENCES "photo_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_colors" ADD CONSTRAINT "gear_colors_gear_type_id_fkey" FOREIGN KEY ("gear_type_id") REFERENCES "gear_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_photo_categories" ADD CONSTRAINT "event_photo_categories_photo_category_id_fkey" FOREIGN KEY ("photo_category_id") REFERENCES "photo_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_participant_category_id_fkey" FOREIGN KEY ("participant_category_id") REFERENCES "participant_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

