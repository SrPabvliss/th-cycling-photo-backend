-- AlterTable
ALTER TABLE "photos" ADD COLUMN "retouched_storage_key" VARCHAR(500),
ADD COLUMN "retouched_file_size" BIGINT,
ADD COLUMN "retouched_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "photos_retouched_storage_key_key" ON "photos"("retouched_storage_key");
