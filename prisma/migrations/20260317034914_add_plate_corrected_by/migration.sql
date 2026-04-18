-- AlterTable
ALTER TABLE "plate_numbers" ADD COLUMN     "corrected_by_id" UUID;

-- AddForeignKey
ALTER TABLE "plate_numbers" ADD CONSTRAINT "plate_numbers_corrected_by_id_fkey" FOREIGN KEY ("corrected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
