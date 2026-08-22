-- AlterTable
ALTER TABLE "events" ADD COLUMN     "frozen_at" TIMESTAMPTZ,
ADD COLUMN     "is_frozen" BOOLEAN NOT NULL DEFAULT false;
