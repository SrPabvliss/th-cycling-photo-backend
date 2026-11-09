-- AlterEnum
ALTER TYPE "event_status" ADD VALUE 'frozen';

-- DropForeignKey
ALTER TABLE "tenant_payout_methods" DROP CONSTRAINT "tenant_payout_methods_configured_by_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_payout_methods" DROP CONSTRAINT "tenant_payout_methods_tenant_id_fkey";

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "snap_public_name" VARCHAR(200),
ADD COLUMN     "snap_watermark_storage_key" VARCHAR(500),
ADD COLUMN     "snap_whatsapp_number" VARCHAR(20);

-- CreateTable
CREATE TABLE "event_payout_methods" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "provider" "payout_provider" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "mode" "payment_mode",
    "receiver_identifier" VARCHAR(100),
    "bank_name" VARCHAR(100),
    "account_number" VARCHAR(50),
    "account_type" VARCHAR(20),
    "account_holder" VARCHAR(200),
    "holder_identification" VARCHAR(20),
    "source_payout_method_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_payout_methods_event_id_is_active_idx" ON "event_payout_methods"("event_id", "is_active");

-- AddForeignKey
ALTER TABLE "tenant_payout_methods" ADD CONSTRAINT "tenant_payout_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_payout_methods" ADD CONSTRAINT "tenant_payout_methods_configured_by_id_fkey" FOREIGN KEY ("configured_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_payout_methods" ADD CONSTRAINT "event_payout_methods_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_payout_methods" ADD CONSTRAINT "event_payout_methods_source_payout_method_id_fkey" FOREIGN KEY ("source_payout_method_id") REFERENCES "tenant_payout_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
