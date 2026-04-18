-- AlterTable
ALTER TABLE "events" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "events_deleted_at_idx" ON "events"("deleted_at");
