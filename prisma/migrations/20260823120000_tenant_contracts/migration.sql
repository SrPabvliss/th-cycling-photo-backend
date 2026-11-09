CREATE TYPE "contract_status" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE "tenant_contracts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "commercial_name" VARCHAR(200) NOT NULL,
    "events_total" INTEGER NOT NULL,
    "photos_per_event" INTEGER,
    "status" "contract_status" NOT NULL DEFAULT 'pending',
    "token_hash" VARCHAR(64) NOT NULL,
    "valid_until" TIMESTAMPTZ NOT NULL,
    "terms_version" VARCHAR(20) NOT NULL,
    "issued_by_id" UUID,
    "is_backfill" BOOLEAN NOT NULL DEFAULT false,
    "accepted_at" TIMESTAMPTZ,
    "accepted_ip" VARCHAR(45),
    "accepted_user_agent" VARCHAR(500),
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_contracts_token_hash_key" ON "tenant_contracts"("token_hash");
CREATE INDEX "tenant_contracts_user_id_idx" ON "tenant_contracts"("user_id");
CREATE INDEX "tenant_contracts_tenant_id_idx" ON "tenant_contracts"("tenant_id");
CREATE INDEX "tenant_contracts_status_idx" ON "tenant_contracts"("status");

ALTER TABLE "tenant_contracts" ADD CONSTRAINT "tenant_contracts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_contracts" ADD CONSTRAINT "tenant_contracts_issued_by_id_fkey"
    FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_contracts" ADD CONSTRAINT "tenant_contracts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD COLUMN "contract_id" UUID;
CREATE INDEX "events_contract_id_idx" ON "events"("contract_id");
ALTER TABLE "events" ADD CONSTRAINT "events_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "tenant_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
