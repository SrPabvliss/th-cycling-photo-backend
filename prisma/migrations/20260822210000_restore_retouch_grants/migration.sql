-- TIT-40 dropped `event_operators` after copying its rows into per-event
-- grants. The copy resolves permissions by key against the `permissions`
-- table, but that table is still empty while migrations run: it is filled by
-- the catalog sync, which the entrypoint runs *after* `migrate deploy`. So on
-- any database that had not already synced the catalog — production — the copy
-- matched nothing, inserted zero rows, and the source table was dropped anyway.
--
-- Production held ten assignments, all for avilesalex013@gmail.com across all
-- ten events, dating back to May. `platform_staff` does not include retouch, so
-- without these grants that account loses retouch everywhere and cannot regain
-- it on its own.
--
-- This migration does not repeat TIT-40's mistake: it seeds the four
-- permissions it needs before using them, so it no longer depends on the
-- catalog having been synced. The later sync upserts the same rows by key and
-- leaves these untouched.
--
-- Ids come from the production dump taken 2026-08-22 (see
-- event_operators-prod-20260822.sql). Everything is idempotent and scoped by
-- id, so this is a no-op on any database that lacks those rows — including
-- fresh shadow databases and every developer machine.

INSERT INTO "permissions" ("id", "key", "category", "is_platform_only", "allows_event_scope")
VALUES
  (gen_random_uuid(), 'photo.retouch.read',      'retouch',   false, true),
  (gen_random_uuid(), 'photo.retouch.upload',    'retouch',   false, true),
  (gen_random_uuid(), 'photo.retouch.flag',      'retouch',   false, true),
  (gen_random_uuid(), 'dashboard.operator.read', 'dashboard', false, false)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "user_permission_grants" (
  "id", "user_id", "permission_id", "scope_type", "event_id",
  "effect", "granted_by_id", "granted_at"
)
SELECT
  gen_random_uuid(),
  u."id",
  p."id",
  'event'::"grant_scope_type",
  e."id",
  'allow'::"grant_effect",
  u."id",
  now()
FROM "users" u
CROSS JOIN "permissions" p
CROSS JOIN "events" e
WHERE u."id" = '1b51f5e5-f80b-429d-9bbc-c7babccdc5e9'
  AND p."key" IN (
    'photo.retouch.read',
    'photo.retouch.upload',
    'photo.retouch.flag',
    'dashboard.operator.read'
  )
  AND e."id" IN (
    '107065a9-a921-4950-9270-41654db31d5e',
    '13f85692-56b5-46f8-9b7d-5b5242597872',
    '2e18e58c-5220-4fd3-ab06-fd54c5677bf5',
    '481aa47a-f83e-45cc-beae-a083f84efed9',
    '48a131cc-b2ba-4e75-b64e-975d699effa2',
    '5ab2fc02-dbb8-4f1f-a919-73ef29a92c79',
    '5f88b52d-8cb6-4965-bb54-857ba5a275e1',
    '6dbb07ee-8361-4efe-8310-40b86057b373',
    'dd02092b-530a-48ae-b25d-a3476bd43cd7',
    'f05b2fb6-106b-40b2-b710-dfc26d0855f5'
  )
ON CONFLICT DO NOTHING;
