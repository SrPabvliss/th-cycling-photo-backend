-- AlterTable
ALTER TABLE "events" ADD COLUMN     "photo_quota" INTEGER,
ADD COLUMN     "photos_uploaded" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "default_event_photo_quota" INTEGER;
