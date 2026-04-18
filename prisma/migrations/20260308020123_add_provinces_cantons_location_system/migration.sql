-- CreateTable
CREATE TABLE "provinces" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(10) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cantons" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "province_id" INTEGER NOT NULL,

    CONSTRAINT "cantons_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "events" ADD COLUMN "province_id" INTEGER,
ADD COLUMN "canton_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "provinces_code_key" ON "provinces"("code");

-- CreateIndex
CREATE INDEX "cantons_province_id_idx" ON "cantons"("province_id");

-- CreateIndex
CREATE INDEX "events_province_id_idx" ON "events"("province_id");

-- CreateIndex
CREATE INDEX "events_canton_id_idx" ON "events"("canton_id");

-- CreateIndex (storage_key unique constraint for photos if not already present)
CREATE UNIQUE INDEX IF NOT EXISTS "photos_storage_key_key" ON "photos"("storage_key");

-- AddForeignKey
ALTER TABLE "cantons" ADD CONSTRAINT "cantons_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_canton_id_fkey" FOREIGN KEY ("canton_id") REFERENCES "cantons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
