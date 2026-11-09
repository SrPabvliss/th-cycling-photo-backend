-- CreateEnum
CREATE TYPE "payment_mode" AS ENUM ('own_merchant', 'split_receiver');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('payphone');

-- CreateEnum
CREATE TYPE "payment_account_status" AS ENUM ('pending', 'verified', 'disabled');

-- CreateEnum
CREATE TYPE "payment_transaction_status" AS ENUM ('initiated', 'confirming', 'approved', 'declined', 'expired', 'reversed');

-- CreateTable
CREATE TABLE "seller_payment_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "mode" "payment_mode" NOT NULL,
    "status" "payment_account_status" NOT NULL DEFAULT 'pending',
    "receiver_identifier" VARCHAR(100),
    "credentials_encrypted" TEXT,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "client_transaction_id" VARCHAR(50) NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "gateway_transaction_id" VARCHAR(100),
    "status" "payment_transaction_status" NOT NULL DEFAULT 'initiated',
    "amount_cents" INTEGER NOT NULL,
    "amount_without_tax_cents" INTEGER NOT NULL,
    "amount_with_tax_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "transfer_to_cents" INTEGER,
    "mode_snapshot" "payment_mode" NOT NULL,
    "receiver_snapshot" VARCHAR(100) NOT NULL,
    "store_id_snapshot" VARCHAR(100),
    "authorization_code" VARCHAR(50),
    "card_brand" VARCHAR(80),
    "last_digits" VARCHAR(8),
    "confirm_payload" JSONB,
    "failure_message" TEXT,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_payment_accounts_user_id_key" ON "seller_payment_accounts"("user_id");

-- CreateIndex
CREATE INDEX "seller_payment_accounts_status_idx" ON "seller_payment_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_client_transaction_id_key" ON "payment_transactions"("client_transaction_id");

-- CreateIndex
CREATE INDEX "payment_transactions_order_id_idx" ON "payment_transactions"("order_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- AddForeignKey
ALTER TABLE "seller_payment_accounts" ADD CONSTRAINT "seller_payment_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
