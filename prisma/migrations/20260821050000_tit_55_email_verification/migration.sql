-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" VARCHAR(20) NOT NULL,
    "target_email" VARCHAR(255) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_codes_user_id_idx" ON "email_verification_codes"("user_id");

-- AddForeignKey
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "user_prompt_snoozes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "prompt_key" VARCHAR(40) NOT NULL,
    "snoozed_until" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_prompt_snoozes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_prompt_snoozes_user_id_idx" ON "user_prompt_snoozes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_prompt_snoozes_user_id_prompt_key_key" ON "user_prompt_snoozes"("user_id", "prompt_key");

-- AddForeignKey
ALTER TABLE "user_prompt_snoozes" ADD CONSTRAINT "user_prompt_snoozes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
