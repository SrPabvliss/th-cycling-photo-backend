-- DropIndex
DROP INDEX "events_event_type_idx";

-- DropIndex
DROP INDEX "gear_types_event_type_idx";

-- DropIndex
DROP INDEX "gear_types_name_event_type_key";

-- DropIndex
DROP INDEX "participant_categories_event_type_idx";

-- DropIndex
DROP INDEX "participant_categories_name_event_type_key";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "event_type",
ADD COLUMN     "event_type_id" UUID;

-- AlterTable
ALTER TABLE "gear_types" DROP COLUMN "event_type",
ADD COLUMN     "event_type_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "participant_categories" DROP COLUMN "event_type",
ADD COLUMN     "event_type_id" UUID NOT NULL;

-- DropEnum
DROP TYPE "event_type";

-- CreateTable
CREATE TABLE "event_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_types_name_key" ON "event_types"("name");

-- CreateIndex
CREATE INDEX "events_event_type_id_idx" ON "events"("event_type_id");

-- CreateIndex
CREATE INDEX "gear_types_event_type_id_idx" ON "gear_types"("event_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "gear_types_name_event_type_id_key" ON "gear_types"("name", "event_type_id");

-- CreateIndex
CREATE INDEX "participant_categories_event_type_id_idx" ON "participant_categories"("event_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "participant_categories_name_event_type_id_key" ON "participant_categories"("name", "event_type_id");

-- AddForeignKey
ALTER TABLE "participant_categories" ADD CONSTRAINT "participant_categories_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_types" ADD CONSTRAINT "gear_types_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

