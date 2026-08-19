/*
  Warnings:

  - You are about to drop the column `order_id` on the `payment_transactions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('card', 'transfer');

-- DropForeignKey
ALTER TABLE "payment_transactions" DROP CONSTRAINT "payment_transactions_order_id_fkey";

-- DropIndex
DROP INDEX "payment_transactions_order_id_idx";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_method" "payment_method";

-- AlterTable
ALTER TABLE "payment_transactions" DROP COLUMN "order_id";

-- CreateTable
CREATE TABLE "payment_transaction_orders" (
    "payment_transaction_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,

    CONSTRAINT "payment_transaction_orders_pkey" PRIMARY KEY ("payment_transaction_id","order_id")
);

-- CreateIndex
CREATE INDEX "payment_transaction_orders_order_id_idx" ON "payment_transaction_orders"("order_id");

-- AddForeignKey
ALTER TABLE "payment_transaction_orders" ADD CONSTRAINT "payment_transaction_orders_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transaction_orders" ADD CONSTRAINT "payment_transaction_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
