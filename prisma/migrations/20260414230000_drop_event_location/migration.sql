-- Drop deprecated location column from events (replaced by province + canton relations)
ALTER TABLE "events" DROP COLUMN "location";
