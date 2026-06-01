-- AlterTable
ALTER TABLE "events" ADD COLUMN     "pricing_config" JSONB;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "snap_currency" VARCHAR(3),
ADD COLUMN     "snap_pricing_config" JSONB;
