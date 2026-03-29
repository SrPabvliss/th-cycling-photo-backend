-- AlterTable
ALTER TABLE "provinces" ADD COLUMN     "country_id" INTEGER;

-- CreateIndex
CREATE INDEX "provinces_country_id_idx" ON "provinces"("country_id");

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: assign all existing provinces to Ecuador
UPDATE "provinces" SET "country_id" = (SELECT "id" FROM "countries" WHERE "iso_code" = 'EC')
WHERE "country_id" IS NULL;
