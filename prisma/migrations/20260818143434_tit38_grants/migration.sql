-- CreateEnum
CREATE TYPE "grant_scope_type" AS ENUM ('global', 'event');

-- CreateEnum
CREATE TYPE "grant_effect" AS ENUM ('allow', 'deny');

-- CreateTable
CREATE TABLE "user_permission_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "scope_type" "grant_scope_type" NOT NULL,
    "event_id" UUID,
    "effect" "grant_effect" NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permission_grants_user_id_idx" ON "user_permission_grants"("user_id");

-- CreateIndex
CREATE INDEX "user_permission_grants_event_id_idx" ON "user_permission_grants"("event_id");

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Postgres treats NULLs as distinct, so without NULLS NOT DISTINCT this index
-- would accept duplicate global grants. Requires PG 15+.
CREATE UNIQUE INDEX user_permission_grants_unique
  ON user_permission_grants (user_id, permission_id, scope_type, event_id)
  NULLS NOT DISTINCT;
