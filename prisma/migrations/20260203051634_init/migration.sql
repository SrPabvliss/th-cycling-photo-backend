-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('draft', 'uploading', 'processing', 'completed');

-- CreateEnum
CREATE TYPE "photo_status" AS ENUM ('pending', 'detecting', 'analyzing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "unclassified_reason" AS ENUM ('no_cyclist', 'ocr_failed', 'low_confidence', 'processing_error');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "job_type" AS ENUM ('detection', 'ocr', 'color_analysis');

-- CreateEnum
CREATE TYPE "processing_stage" AS ENUM ('detection', 'ocr', 'color_analysis', 'completed');

-- CreateEnum
CREATE TYPE "equipment_item" AS ENUM ('helmet', 'jersey', 'bike');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "event_date" DATE NOT NULL,
    "location" VARCHAR(200),
    "status" "event_status" NOT NULL DEFAULT 'draft',
    "total_photos" INTEGER NOT NULL DEFAULT 0,
    "processed_photos" INTEGER NOT NULL DEFAULT 0,
    "exported_photos" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
    "width" INTEGER,
    "height" INTEGER,
    "status" "photo_status" NOT NULL DEFAULT 'pending',
    "unclassified_reason" "unclassified_reason",
    "captured_at" TIMESTAMPTZ,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detected_cyclists" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "bounding_box" JSONB NOT NULL,
    "confidence_score" DECIMAL(5,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detected_cyclists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plate_numbers" (
    "id" UUID NOT NULL,
    "detected_cyclist_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "confidence_score" DECIMAL(5,4),
    "manually_corrected" BOOLEAN NOT NULL DEFAULT false,
    "corrected_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plate_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_colors" (
    "id" UUID NOT NULL,
    "detected_cyclist_id" UUID NOT NULL,
    "item_type" "equipment_item" NOT NULL,
    "color_name" VARCHAR(50) NOT NULL,
    "color_hex" VARCHAR(7) NOT NULL,
    "density_percentage" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" UUID NOT NULL,
    "photo_id" UUID NOT NULL,
    "job_type" "job_type" NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'pending',
    "processing_stage" "processing_stage" NOT NULL,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_event_date_idx" ON "events"("event_date" DESC);

-- CreateIndex
CREATE INDEX "photos_event_id_idx" ON "photos"("event_id");

-- CreateIndex
CREATE INDEX "photos_status_idx" ON "photos"("status");

-- CreateIndex
CREATE INDEX "idx_photos_unclassified" ON "photos"("event_id", "unclassified_reason");

-- CreateIndex
CREATE UNIQUE INDEX "unique_event_filename" ON "photos"("event_id", "filename");

-- CreateIndex
CREATE INDEX "detected_cyclists_photo_id_idx" ON "detected_cyclists"("photo_id");

-- CreateIndex
CREATE INDEX "detected_cyclists_confidence_score_idx" ON "detected_cyclists"("confidence_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "plate_numbers_detected_cyclist_id_key" ON "plate_numbers"("detected_cyclist_id");

-- CreateIndex
CREATE INDEX "plate_numbers_number_idx" ON "plate_numbers"("number");

-- CreateIndex
CREATE INDEX "plate_numbers_detected_cyclist_id_idx" ON "plate_numbers"("detected_cyclist_id");

-- CreateIndex
CREATE INDEX "equipment_colors_detected_cyclist_id_idx" ON "equipment_colors"("detected_cyclist_id");

-- CreateIndex
CREATE INDEX "equipment_colors_item_type_idx" ON "equipment_colors"("item_type");

-- CreateIndex
CREATE INDEX "equipment_colors_color_name_idx" ON "equipment_colors"("color_name");

-- CreateIndex
CREATE INDEX "processing_jobs_photo_id_idx" ON "processing_jobs"("photo_id");

-- CreateIndex
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs"("status");

-- CreateIndex
CREATE INDEX "processing_jobs_job_type_idx" ON "processing_jobs"("job_type");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detected_cyclists" ADD CONSTRAINT "detected_cyclists_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plate_numbers" ADD CONSTRAINT "plate_numbers_detected_cyclist_id_fkey" FOREIGN KEY ("detected_cyclist_id") REFERENCES "detected_cyclists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_colors" ADD CONSTRAINT "equipment_colors_detected_cyclist_id_fkey" FOREIGN KEY ("detected_cyclist_id") REFERENCES "detected_cyclists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
