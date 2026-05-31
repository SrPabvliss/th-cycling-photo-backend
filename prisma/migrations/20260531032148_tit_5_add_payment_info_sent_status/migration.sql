-- AlterEnum
ALTER TYPE "order_status" ADD VALUE 'payment_info_sent';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "notified_at" TIMESTAMPTZ,
ADD COLUMN     "notified_by_id" UUID;

-- CreateIndex
CREATE INDEX "orders_notified_by_id_idx" ON "orders"("notified_by_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_notified_by_id_fkey" FOREIGN KEY ("notified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
