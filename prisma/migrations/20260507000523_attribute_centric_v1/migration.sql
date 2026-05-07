-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'photo_status' AND e.enumlabel = 'reviewed') THEN
    CREATE TYPE "photo_status_new" AS ENUM ('pending', 'processing', 'processed', 'failed', 'reviewed');
    ALTER TABLE "public"."photos" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "photos" ALTER COLUMN "status" TYPE "photo_status_new" USING (
      CASE "status"::text
        WHEN 'detecting' THEN 'processing'::"photo_status_new"
        WHEN 'analyzing' THEN 'processing'::"photo_status_new"
        WHEN 'completed' THEN 'processed'::"photo_status_new"
        ELSE "status"::text::"photo_status_new"
      END
    );
    ALTER TYPE "photo_status" RENAME TO "photo_status_old";
    ALTER TYPE "photo_status_new" RENAME TO "photo_status";
    DROP TYPE "public"."photo_status_old";
    ALTER TABLE "photos" ALTER COLUMN "status" SET DEFAULT 'pending';
  END IF;
END$$;

-- DropForeignKey
ALTER TABLE IF EXISTS "processing_jobs" DROP CONSTRAINT IF EXISTS "processing_jobs_photo_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "idx_photos_unclassified";

-- AlterTable
ALTER TABLE "photos" DROP COLUMN IF EXISTS "classified_at",
DROP COLUMN IF EXISTS "unclassified_reason",
ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ;

-- DropTable
DROP TABLE IF EXISTS "detection_metadata" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "gear_colors" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "participant_identifiers" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "detected_participants" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "gear_types" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "processing_jobs" CASCADE;

-- DropEnum
DROP TYPE IF EXISTS "classification_source";

-- DropEnum
DROP TYPE IF EXISTS "job_status";

-- DropEnum
DROP TYPE IF EXISTS "processing_stage";

-- DropEnum
DROP TYPE IF EXISTS "unclassified_reason";

-- DropEnum
DROP TYPE IF EXISTS "job_type";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttributeSource" AS ENUM ('ai', 'reviewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ProcessingStatus" AS ENUM ('running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ProcessingStageName" AS ENUM ('detection', 'ocr', 'color');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ProcessingStageStatus" AS ENUM ('ok', 'partial', 'skipped', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BibReadingStatus" AS ENUM ('matched', 'abstained', 'unmatched');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ColorRegion" AS ENUM ('helmet', 'cyclist_clothes', 'bicycle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CorrectionTargetType" AS ENUM ('photo_bib', 'photo_color');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE "photo_processings" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "schema_version" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL,
    "total_ms" DOUBLE PRECISION NOT NULL,
    "model_versions" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "photo_processings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_processing_stages" (
    "id" UUID NOT NULL,
    "photo_processing_id" UUID NOT NULL,
    "stage" "ProcessingStageName" NOT NULL,
    "status" "ProcessingStageStatus" NOT NULL,
    "ms" DOUBLE PRECISION NOT NULL,
    "items_processed" INTEGER NOT NULL,
    "items_succeeded" INTEGER NOT NULL,
    "items_failed" INTEGER NOT NULL,
    "notes" JSONB NOT NULL,

    CONSTRAINT "photo_processing_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_detections" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "photo_processing_id" UUID NOT NULL,
    "class_name" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "bbox" JSONB NOT NULL,

    CONSTRAINT "photo_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_bibs" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "photo_processing_id" UUID,
    "source" "AttributeSource" NOT NULL,
    "digits" TEXT NOT NULL,
    "confidence" DECIMAL(4,3),
    "confidence_per_digit" JSONB,
    "status" "BibReadingStatus",
    "rejection_reason" TEXT,
    "raw_ocr_text" TEXT,
    "bbox_source" JSONB,
    "preprocessing_applied" JSONB,
    "processing_ms" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "photo_bibs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_colors" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "photo_processing_id" UUID,
    "source" "AttributeSource" NOT NULL,
    "region" "ColorRegion" NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT,
    "confidence" DECIMAL(4,3),
    "bbox_source" JSONB,
    "strategy" TEXT,
    "processing_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "photo_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrections" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "target_type" "CorrectionTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reviewer_id" UUID NOT NULL,
    "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photo_processings_photo_id_idx" ON "photo_processings"("photo_id");

-- CreateIndex
CREATE INDEX "photo_processings_started_at_idx" ON "photo_processings"("started_at");

-- CreateIndex
CREATE INDEX "photo_processing_stages_stage_status_idx" ON "photo_processing_stages"("stage", "status");

-- CreateIndex
CREATE UNIQUE INDEX "photo_processing_stages_photo_processing_id_stage_key" ON "photo_processing_stages"("photo_processing_id", "stage");

-- CreateIndex
CREATE INDEX "photo_detections_photo_id_idx" ON "photo_detections"("photo_id");

-- CreateIndex
CREATE INDEX "photo_detections_class_name_idx" ON "photo_detections"("class_name");

-- CreateIndex
CREATE INDEX "photo_bibs_photo_id_idx" ON "photo_bibs"("photo_id");

-- CreateIndex
CREATE INDEX "photo_bibs_digits_idx" ON "photo_bibs"("digits");

-- CreateIndex
CREATE INDEX "photo_colors_photo_id_idx" ON "photo_colors"("photo_id");

-- CreateIndex
CREATE INDEX "photo_colors_region_primary_color_idx" ON "photo_colors"("region", "primary_color");

-- CreateIndex
CREATE INDEX "corrections_photo_id_idx" ON "corrections"("photo_id");

-- CreateIndex
CREATE INDEX "corrections_target_type_target_id_idx" ON "corrections"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "corrections_target_type_target_id_field_corrected_at_idx" ON "corrections"("target_type", "target_id", "field", "corrected_at" DESC);

-- AddForeignKey
ALTER TABLE "photo_processings" ADD CONSTRAINT "photo_processings_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_processing_stages" ADD CONSTRAINT "photo_processing_stages_photo_processing_id_fkey" FOREIGN KEY ("photo_processing_id") REFERENCES "photo_processings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_detections" ADD CONSTRAINT "photo_detections_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_detections" ADD CONSTRAINT "photo_detections_photo_processing_id_fkey" FOREIGN KEY ("photo_processing_id") REFERENCES "photo_processings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_bibs" ADD CONSTRAINT "photo_bibs_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_bibs" ADD CONSTRAINT "photo_bibs_photo_processing_id_fkey" FOREIGN KEY ("photo_processing_id") REFERENCES "photo_processings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_bibs" ADD CONSTRAINT "photo_bibs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_colors" ADD CONSTRAINT "photo_colors_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_colors" ADD CONSTRAINT "photo_colors_photo_processing_id_fkey" FOREIGN KEY ("photo_processing_id") REFERENCES "photo_processings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_colors" ADD CONSTRAINT "photo_colors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- View: photo_bib_effective
CREATE VIEW photo_bib_effective AS
SELECT
  b.id,
  b.photo_id,
  b.source,
  b.digits AS digits_original,
  COALESCE(c_digits.new_value, b.digits) AS digits_effective,
  (c_digits.id IS NOT NULL) AS digits_was_corrected,
  c_digits.corrected_at AS digits_corrected_at,
  c_digits.reviewer_id AS digits_corrected_by,
  b.confidence,
  b.status AS status_original,
  b.raw_ocr_text,
  b.bbox_source,
  b.created_at
FROM photo_bibs b
LEFT JOIN LATERAL (
  SELECT id, new_value, corrected_at, reviewer_id
  FROM corrections
  WHERE target_type = 'photo_bib' AND target_id = b.id AND field = 'digits'
  ORDER BY corrected_at DESC
  LIMIT 1
) c_digits ON TRUE;

-- View: photo_color_effective
CREATE VIEW photo_color_effective AS
SELECT
  c.id,
  c.photo_id,
  c.source,
  c.region,
  c.primary_color AS primary_original,
  COALESCE(cp.new_value, c.primary_color) AS primary_effective,
  (cp.id IS NOT NULL) AS primary_was_corrected,
  cp.corrected_at AS primary_corrected_at,
  c.secondary_color AS secondary_original,
  COALESCE(cs.new_value, c.secondary_color) AS secondary_effective,
  (cs.id IS NOT NULL) AS secondary_was_corrected,
  cs.corrected_at AS secondary_corrected_at,
  c.confidence,
  c.strategy,
  c.bbox_source,
  c.created_at
FROM photo_colors c
LEFT JOIN LATERAL (
  SELECT id, new_value, corrected_at, reviewer_id
  FROM corrections
  WHERE target_type = 'photo_color' AND target_id = c.id AND field = 'primary_color'
  ORDER BY corrected_at DESC LIMIT 1
) cp ON TRUE
LEFT JOIN LATERAL (
  SELECT id, new_value, corrected_at, reviewer_id
  FROM corrections
  WHERE target_type = 'photo_color' AND target_id = c.id AND field = 'secondary_color'
  ORDER BY corrected_at DESC LIMIT 1
) cs ON TRUE;
