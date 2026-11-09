-- CreateEnum
CREATE TYPE "payout_provider" AS ENUM ('payphone', 'bank_transfer');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "public_name" VARCHAR(200),
ADD COLUMN     "watermark_storage_key" VARCHAR(500),
ADD COLUMN     "whatsapp_number" VARCHAR(20),
ADD COLUMN     "whatsapp_verified_at" TIMESTAMPTZ;

ALTER TABLE "seller_payment_accounts" RENAME TO "tenant_payout_methods";
ALTER TABLE "tenant_payout_methods" RENAME CONSTRAINT "seller_payment_accounts_pkey" TO "tenant_payout_methods_pkey";

ALTER TABLE "tenant_payout_methods"
  ADD COLUMN "tenant_id" UUID,
  ADD COLUMN "provider_new" "payout_provider" NOT NULL DEFAULT 'payphone',
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bank_name" VARCHAR(100),
  ADD COLUMN "account_number" VARCHAR(50),
  ADD COLUMN "account_type" VARCHAR(20),
  ADD COLUMN "account_holder" VARCHAR(200),
  ADD COLUMN "holder_identification" VARCHAR(20),
  ADD COLUMN "configured_by_id" UUID;

UPDATE "tenant_payout_methods" m
SET "configured_by_id" = m."user_id",
    "tenant_id" = COALESCE(
      (SELECT u."tenant_id" FROM "users" u WHERE u."id" = m."user_id"),
      (SELECT t."id" FROM "tenants" t WHERE t."is_platform" = true LIMIT 1)
    );

DELETE FROM "tenant_payout_methods" WHERE "tenant_id" IS NULL;

ALTER TABLE "tenant_payout_methods"
  ALTER COLUMN "tenant_id" SET NOT NULL,
  ALTER COLUMN "mode" DROP NOT NULL,
  DROP COLUMN "provider",
  DROP COLUMN "user_id";

ALTER TABLE "tenant_payout_methods" RENAME COLUMN "provider_new" TO "provider";
ALTER TABLE "tenant_payout_methods" ALTER COLUMN "provider" DROP DEFAULT;

DROP INDEX IF EXISTS "seller_payment_accounts_user_id_key";
DROP INDEX IF EXISTS "seller_payment_accounts_status_idx";
CREATE INDEX "tenant_payout_methods_tenant_id_is_active_idx"
  ON "tenant_payout_methods" ("tenant_id", "is_active");

ALTER TABLE "tenant_payout_methods"
  ADD CONSTRAINT "tenant_payout_methods_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "tenant_payout_methods_configured_by_id_fkey"
    FOREIGN KEY ("configured_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
