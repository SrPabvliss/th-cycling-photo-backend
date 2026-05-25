-- AlterTable
ALTER TABLE "photo_bibs" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "deleted_by_id" UUID;

-- AlterTable
ALTER TABLE "photo_colors" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "deleted_by_id" UUID;

-- CreateIndex
CREATE INDEX "photo_bibs_deleted_at_idx" ON "photo_bibs"("deleted_at");

-- CreateIndex
CREATE INDEX "photo_colors_deleted_at_idx" ON "photo_colors"("deleted_at");

-- AddForeignKey
ALTER TABLE "photo_bibs" ADD CONSTRAINT "photo_bibs_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_colors" ADD CONSTRAINT "photo_colors_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
