-- TIT-38: Tenant entity + backfill.
--
-- Introduces `tenants` as the ownership boundary that later TIT-38 tasks
-- hang permissions off. Nothing is enforced yet: every existing row is
-- backfilled onto a single "Titan TV" platform tenant so behaviour is
-- unchanged. Several statements below are hand-written rather than
-- Prisma-generated DDL because they express constraints or data migrations
-- Prisma's schema DSL cannot produce on its own (partial indexes, seed
-- data, conditional backfills, fail-loud guards).

-- 1. tenants table (standard Prisma-generated CreateTable)
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_platform" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- 2. Exactly one platform tenant, enforced at the database level.
-- Raw SQL: Prisma's schema DSL has no syntax for partial unique indexes,
-- so this is added by hand. Indexing the constant `(true)` under a WHERE
-- clause means at most one row can ever have is_platform = true.
CREATE UNIQUE INDEX "tenants_single_platform" ON "tenants" ((true)) WHERE "is_platform";

-- 3. Seed the platform tenant.
-- Raw SQL: seed data, not schema — Prisma's migration diff never generates
-- INSERTs.
INSERT INTO "tenants" ("id", "name", "is_platform", "created_at")
VALUES (gen_random_uuid(), 'Titan TV', true, now());

-- 4. events.tenant_id: add nullable, backfill every existing event onto the
-- platform tenant, then enforce NOT NULL.
-- Raw SQL: a straight Prisma-generated `ADD COLUMN ... NOT NULL` fails
-- outright against a non-empty table with no default to backfill from, so
-- the column is opened up, backfilled, then locked down in three steps.
ALTER TABLE "events" ADD COLUMN "tenant_id" UUID;
UPDATE "events" SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "is_platform");
ALTER TABLE "events" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "events_tenant_id_idx" ON "events"("tenant_id");

-- 5. users: new columns (standard Prisma-generated AlterTable/AddForeignKey/
-- CreateIndex — tenant_id is nullable here because buyers have no tenant).
ALTER TABLE "users" ADD COLUMN "is_protected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "permissions_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tenant_id" UUID;
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- Staff (admin/operator) join the platform tenant; buyers stay tenant-less.
-- Raw SQL: conditional backfill keyed off role membership, not schema.
UPDATE "users" u SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "is_platform")
WHERE EXISTS (
  SELECT 1 FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."role_id"
  WHERE ur."user_id" = u."id" AND r."name" IN ('admin', 'operator')
);

-- 6. Break-glass account: the one platform user immune to permission
-- lockout, so an authorization misconfiguration in later TIT-38 tasks can
-- never leave the platform with no path to recovery.
-- Raw SQL: fails loudly (rather than silently leaving no recovery path) if
-- the operator running this migration didn't set the session variable, or
-- if it doesn't resolve to exactly one platform user.
DO $$
DECLARE target_email TEXT := current_setting('tit38.break_glass_email', true);
        affected INT;
BEGIN
  IF target_email IS NULL OR target_email = '' THEN
    RAISE EXCEPTION 'tit38.break_glass_email must be set before running this migration';
  END IF;
  UPDATE "users" SET "is_protected" = true
  WHERE "email" = target_email AND "tenant_id" = (SELECT "id" FROM "tenants" WHERE "is_platform");
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'break-glass email % matched % platform users, expected exactly 1',
      target_email, affected;
  END IF;
END $$;
