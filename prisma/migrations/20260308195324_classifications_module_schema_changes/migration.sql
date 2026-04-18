-- CreateEnum
CREATE TYPE "classification_source" AS ENUM ('manual', 'ai');

-- AlterEnum
BEGIN;
CREATE TYPE "equipment_item_new" AS ENUM ('helmet', 'clothing', 'bike');
ALTER TABLE "equipment_colors" ALTER COLUMN "item_type" TYPE "equipment_item_new" USING ("item_type"::text::"equipment_item_new");
ALTER TYPE "equipment_item" RENAME TO "equipment_item_old";
ALTER TYPE "equipment_item_new" RENAME TO "equipment_item";
DROP TYPE "public"."equipment_item_old";
COMMIT;

-- DropIndex
DROP INDEX "detected_cyclists_confidence_score_idx";

-- DropIndex
DROP INDEX "unique_event_filename";

-- AlterTable
ALTER TABLE "detected_cyclists" DROP COLUMN "bounding_box",
DROP COLUMN "confidence_score",
ADD COLUMN     "source" "classification_source" NOT NULL DEFAULT 'manual',
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "equipment_colors" ADD COLUMN     "raw_hex" VARCHAR(7),
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "density_percentage" DROP NOT NULL;

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "classified_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "plate_numbers" ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "cyclist_ai_metadata" (
    "id" UUID NOT NULL,
    "detected_cyclist_id" UUID NOT NULL,
    "bounding_box" JSONB NOT NULL,
    "detection_confidence" DECIMAL(5,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cyclist_ai_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cyclist_ai_metadata_detected_cyclist_id_key" ON "cyclist_ai_metadata"("detected_cyclist_id");

-- CreateIndex
CREATE INDEX "cyclist_ai_metadata_detected_cyclist_id_idx" ON "cyclist_ai_metadata"("detected_cyclist_id");

-- CreateIndex
CREATE INDEX "photos_event_id_filename_idx" ON "photos"("event_id", "filename");

-- AddForeignKey
ALTER TABLE "cyclist_ai_metadata" ADD CONSTRAINT "cyclist_ai_metadata_detected_cyclist_id_fkey" FOREIGN KEY ("detected_cyclist_id") REFERENCES "detected_cyclists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

