-- DropForeignKey
ALTER TABLE "customer_profiles" DROP CONSTRAINT "customer_profiles_participant_category_id_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_event_type_id_fkey";

-- DropIndex
DROP INDEX "customer_profiles_participant_category_id_idx";

-- AlterTable
ALTER TABLE "customer_profiles" DROP COLUMN "participant_category_id";

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "event_type_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

