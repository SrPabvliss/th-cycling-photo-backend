-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "snap_billing_account_id" UUID,
ADD COLUMN     "snap_billing_address" VARCHAR(300),
ADD COLUMN     "snap_billing_email" VARCHAR(255),
ADD COLUMN     "snap_billing_id_number" VARCHAR(20),
ADD COLUMN     "snap_billing_id_type" "billing_id_type",
ADD COLUMN     "snap_billing_legal_name" VARCHAR(300),
ADD COLUMN     "snap_invoice_consent_at" TIMESTAMPTZ,
ADD COLUMN     "snap_invoice_consent_ip" VARCHAR(45);

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_snap_billing_account_id_fkey" FOREIGN KEY ("snap_billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
