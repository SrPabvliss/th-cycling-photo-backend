-- Drop legacy User.phone (replaced by UserPhone table)
ALTER TABLE "users" DROP COLUMN "phone";

-- Drop legacy Event cover_image fields (replaced by EventAsset)
ALTER TABLE "events" DROP COLUMN "cover_image_url",
DROP COLUMN "cover_image_storage_key";
