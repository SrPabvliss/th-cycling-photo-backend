-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_canton_id_fkey";
ALTER TABLE "customers" DROP CONSTRAINT "customers_country_id_fkey";
ALTER TABLE "customers" DROP CONSTRAINT "customers_province_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_customer_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";

-- DropIndex
DROP INDEX "orders_customer_id_idx";

-- AlterTable: remove customer_id, make user_id NOT NULL
ALTER TABLE "orders" DROP COLUMN "customer_id",
ALTER COLUMN "user_id" SET NOT NULL;

-- DropTable
DROP TABLE "customers";

-- AddForeignKey: user_id now RESTRICT (not SetNull)
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
