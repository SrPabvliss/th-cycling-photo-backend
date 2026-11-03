-- CreateEnum
CREATE TYPE "rikuchiy_outbox_kind" AS ENUM ('emit');

-- CreateEnum
CREATE TYPE "rikuchiy_outbox_status" AS ENUM ('pending', 'sent', 'rejected', 'suppressed');

-- CreateTable
CREATE TABLE "rikuchiy_outbox_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "kind" "rikuchiy_outbox_kind" NOT NULL,
    "emission_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "rikuchiy_outbox_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "rejection_reason" VARCHAR(300),
    "tax_document_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "rikuchiy_outbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rikuchiy_outbox_items_emission_id_key" ON "rikuchiy_outbox_items"("emission_id");

-- CreateIndex
CREATE INDEX "idx_rikuchiy_outbox_items_pending" ON "rikuchiy_outbox_items"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rikuchiy_outbox_items_order_id_kind_key" ON "rikuchiy_outbox_items"("order_id", "kind");

-- AddForeignKey
ALTER TABLE "rikuchiy_outbox_items" ADD CONSTRAINT "rikuchiy_outbox_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
