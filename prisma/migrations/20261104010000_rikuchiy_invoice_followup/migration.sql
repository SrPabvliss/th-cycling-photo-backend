-- AlterEnum
ALTER TYPE "rikuchiy_outbox_kind" ADD VALUE 'annul';

-- CreateEnum
CREATE TYPE "order_invoice_state" AS ENUM ('none', 'requested', 'in_process', 'authorized', 'rejected', 'annulled');

-- AlterTable
ALTER TABLE "rikuchiy_outbox_items" ADD COLUMN "external_ref" VARCHAR(100),
ADD COLUMN "outcome" VARCHAR(20);

UPDATE "rikuchiy_outbox_items" SET "external_ref" = "payload"->'sale'->>'externalRef';

ALTER TABLE "rikuchiy_outbox_items" ALTER COLUMN "external_ref" SET NOT NULL;

-- DropIndex
DROP INDEX "rikuchiy_outbox_items_order_id_kind_key";

-- CreateIndex
CREATE UNIQUE INDEX "rikuchiy_outbox_items_one_pending_per_kind" ON "rikuchiy_outbox_items"("order_id", "kind") WHERE "status" = 'pending';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "invoice_state" "order_invoice_state" NOT NULL DEFAULT 'none',
ADD COLUMN "invoice_synced_at" TIMESTAMPTZ,
ADD COLUMN "invoice_rejection_notified_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "idx_orders_invoice_state" ON "orders"("invoice_state");

UPDATE "orders" SET "invoice_state" = 'requested'
WHERE "id" IN (SELECT "order_id" FROM "rikuchiy_outbox_items" WHERE "status" <> 'suppressed');

-- CreateTable
CREATE TABLE "order_tax_documents" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "external_ref" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "number" VARCHAR(17) NOT NULL,
    "access_key" VARCHAR(49) NOT NULL,
    "issue_date" DATE NOT NULL,
    "authorized_at" TIMESTAMPTZ,
    "sri_messages" JSONB NOT NULL,
    "deliveries" JSONB NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "order_tax_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_tax_documents_order_id_idx" ON "order_tax_documents"("order_id");

-- AddForeignKey
ALTER TABLE "order_tax_documents" ADD CONSTRAINT "order_tax_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
