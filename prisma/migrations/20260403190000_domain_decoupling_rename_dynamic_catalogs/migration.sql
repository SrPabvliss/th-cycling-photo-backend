-- CreateEnum
CREATE TYPE "event_type" AS ENUM ('downhill', 'road', 'trail', 'rally', 'triathlon');

-- DropForeignKey
ALTER TABLE "cyclist_ai_metadata" DROP CONSTRAINT "cyclist_ai_metadata_detected_cyclist_id_fkey";

-- DropForeignKey
ALTER TABLE "detected_cyclists" DROP CONSTRAINT "detected_cyclists_classified_by_id_fkey";

-- DropForeignKey
ALTER TABLE "detected_cyclists" DROP CONSTRAINT "detected_cyclists_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "detected_cyclists" DROP CONSTRAINT "detected_cyclists_photo_id_fkey";

-- DropForeignKey
ALTER TABLE "equipment_colors" DROP CONSTRAINT "equipment_colors_detected_cyclist_id_fkey";

-- DropForeignKey
ALTER TABLE "plate_numbers" DROP CONSTRAINT "plate_numbers_corrected_by_id_fkey";

-- DropForeignKey
ALTER TABLE "plate_numbers" DROP CONSTRAINT "plate_numbers_detected_cyclist_id_fkey";

-- AlterTable
ALTER TABLE "customer_profiles" DROP COLUMN "rider_category",
ADD COLUMN     "participant_category_id" UUID;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "event_type" "event_type" NOT NULL DEFAULT 'downhill';

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "snap_rider_category",
ADD COLUMN     "snap_category_name" VARCHAR(100);

-- DropTable
DROP TABLE "cyclist_ai_metadata";

-- DropTable
DROP TABLE "detected_cyclists";

-- DropTable
DROP TABLE "equipment_colors";

-- DropTable
DROP TABLE "plate_numbers";

-- DropEnum
DROP TYPE "equipment_item";

-- DropEnum
DROP TYPE "rider_category";

-- CreateTable
CREATE TABLE "participant_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "event_type" "event_type" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "event_type" "event_type" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detected_participants" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "source" "classification_source" NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "classified_by_id" UUID,

    CONSTRAINT "detected_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_metadata" (
    "id" UUID NOT NULL,
    "detected_participant_id" UUID NOT NULL,
    "bounding_box" JSONB NOT NULL,
    "detection_confidence" DECIMAL(5,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detection_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_identifiers" (
    "id" UUID NOT NULL,
    "detected_participant_id" UUID NOT NULL,
    "value" VARCHAR(20) NOT NULL,
    "confidence_score" DECIMAL(5,4),
    "manually_corrected" BOOLEAN NOT NULL DEFAULT false,
    "corrected_at" TIMESTAMPTZ,
    "corrected_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_colors" (
    "id" UUID NOT NULL,
    "detected_participant_id" UUID NOT NULL,
    "gear_type_id" UUID NOT NULL,
    "color_name" VARCHAR(50) NOT NULL,
    "color_hex" VARCHAR(7) NOT NULL,
    "raw_hex" VARCHAR(7),
    "density_percentage" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_colors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "participant_categories_event_type_idx" ON "participant_categories"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "participant_categories_name_event_type_key" ON "participant_categories"("name", "event_type");

-- CreateIndex
CREATE INDEX "gear_types_event_type_idx" ON "gear_types"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "gear_types_name_event_type_key" ON "gear_types"("name", "event_type");

-- CreateIndex
CREATE INDEX "detected_participants_photo_id_idx" ON "detected_participants"("photo_id");

-- CreateIndex
CREATE INDEX "detected_participants_created_by_id_idx" ON "detected_participants"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "detection_metadata_detected_participant_id_key" ON "detection_metadata"("detected_participant_id");

-- CreateIndex
CREATE INDEX "detection_metadata_detected_participant_id_idx" ON "detection_metadata"("detected_participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_identifiers_detected_participant_id_key" ON "participant_identifiers"("detected_participant_id");

-- CreateIndex
CREATE INDEX "participant_identifiers_value_idx" ON "participant_identifiers"("value");

-- CreateIndex
CREATE INDEX "participant_identifiers_detected_participant_id_idx" ON "participant_identifiers"("detected_participant_id");

-- CreateIndex
CREATE INDEX "gear_colors_detected_participant_id_idx" ON "gear_colors"("detected_participant_id");

-- CreateIndex
CREATE INDEX "gear_colors_gear_type_id_idx" ON "gear_colors"("gear_type_id");

-- CreateIndex
CREATE INDEX "gear_colors_color_name_idx" ON "gear_colors"("color_name");

-- CreateIndex
CREATE INDEX "customer_profiles_participant_category_id_idx" ON "customer_profiles"("participant_category_id");

-- CreateIndex
CREATE INDEX "events_event_type_idx" ON "events"("event_type");

-- AddForeignKey
ALTER TABLE "detected_participants" ADD CONSTRAINT "detected_participants_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detected_participants" ADD CONSTRAINT "detected_participants_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detected_participants" ADD CONSTRAINT "detected_participants_classified_by_id_fkey" FOREIGN KEY ("classified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_metadata" ADD CONSTRAINT "detection_metadata_detected_participant_id_fkey" FOREIGN KEY ("detected_participant_id") REFERENCES "detected_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_identifiers" ADD CONSTRAINT "participant_identifiers_detected_participant_id_fkey" FOREIGN KEY ("detected_participant_id") REFERENCES "detected_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_identifiers" ADD CONSTRAINT "participant_identifiers_corrected_by_id_fkey" FOREIGN KEY ("corrected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_colors" ADD CONSTRAINT "gear_colors_detected_participant_id_fkey" FOREIGN KEY ("detected_participant_id") REFERENCES "detected_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_colors" ADD CONSTRAINT "gear_colors_gear_type_id_fkey" FOREIGN KEY ("gear_type_id") REFERENCES "gear_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_participant_category_id_fkey" FOREIGN KEY ("participant_category_id") REFERENCES "participant_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

