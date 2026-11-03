-- CreateEnum
CREATE TYPE "billing_id_type" AS ENUM ('ruc', 'national_id', 'passport');

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "id_type" "billing_id_type" NOT NULL,
    "id_number" VARCHAR(20) NOT NULL,
    "legal_name" VARCHAR(300) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "address" VARCHAR(300),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_accounts_user_id_idx" ON "billing_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_one_default_per_user" ON "billing_accounts"("user_id") WHERE "is_default" AND "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
