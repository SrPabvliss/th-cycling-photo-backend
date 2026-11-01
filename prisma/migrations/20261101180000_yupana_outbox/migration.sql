-- CreateEnum
CREATE TYPE "yupana_outbox_kind" AS ENUM ('usage_report', 'photo_declaration');

-- CreateEnum
CREATE TYPE "yupana_outbox_status" AS ENUM ('pending', 'sent', 'rejected');

-- CreateTable
CREATE TABLE "yupana_outbox_items" (
    "id" UUID NOT NULL,
    "kind" "yupana_outbox_kind" NOT NULL,
    "item_key" VARCHAR(120) NOT NULL,
    "photo_id" UUID,
    "payload" JSONB NOT NULL,
    "status" "yupana_outbox_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "rejection_reason" VARCHAR(80),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "yupana_outbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yupana_outbox_items_item_key_key" ON "yupana_outbox_items"("item_key");

-- CreateIndex
CREATE INDEX "idx_yupana_outbox_items_pending" ON "yupana_outbox_items"("status", "kind", "created_at");

-- CreateIndex
CREATE INDEX "idx_yupana_outbox_items_photo" ON "yupana_outbox_items"("photo_id", "kind");

