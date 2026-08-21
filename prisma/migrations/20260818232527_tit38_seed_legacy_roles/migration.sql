-- TIT-38: seed the legacy `roles` rows.
--
-- No migration in this repository has ever inserted `admin` / `operator` /
-- `customer` into `roles` — only `seedRoles()` in `prisma/seed.ts` did, and
-- production never runs that seed (scripts/docker-entrypoint.sh runs
-- `migrate deploy` and the permission-catalog sync only). Without these
-- rows `AuthUserRepository.register()` still throws `auth.role_not_found`,
-- so a genuinely fresh database could not serve registration even after
-- TIT-38's `migrate deploy` + catalog sync.
--
-- This is pre-existing — it predates TIT-38 by months, and production is an
-- existing, already-populated database, so every row below already exists
-- there today. `roles` is legacy data TIT-40 removes, so a one-shot data
-- migration is the right home for it rather than a permanent addition to
-- `syncPermissionCatalog`'s deploy-time contract.
--
-- `ON CONFLICT DO NOTHING` against the unique `name` column: idempotent, and
-- a no-op everywhere these rows already exist.
INSERT INTO "roles" ("id", "name") VALUES
  (gen_random_uuid(), 'admin'),
  (gen_random_uuid(), 'operator'),
  (gen_random_uuid(), 'customer')
ON CONFLICT ("name") DO NOTHING;
