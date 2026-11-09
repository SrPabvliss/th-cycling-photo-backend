-- One accepted contract per existing non-platform tenant, standing in for the
-- deal that was agreed before contracts existed. `is_backfill` marks it as
-- something no human accepted, so it is never mistaken for a signed record.
--
-- ASSUMPTION: the contract is bound to the tenant's OLDEST user, not necessarily its real
-- organizer — there is no better signal in the existing data to identify the organizer.
-- If the actual organizer is a different, later-created user on the same tenant, they will
-- see "No tienes contratos registrados" after this backfill; check for that case by hand
-- when running this against production and reassign the contract's user_id if needed.
--
-- Idempotency guard: skips any tenant that already has a backfill contract, so running this
-- twice against the same database (this project sometimes applies SQL by hand) does not
-- double every tenant's quota.
INSERT INTO "tenant_contracts" (
    "id", "user_id", "tenant_id", "commercial_name", "events_total",
    "photos_per_event", "status", "token_hash", "valid_until", "terms_version",
    "is_backfill", "accepted_at", "created_at"
)
SELECT
    gen_random_uuid(),
    owner."id",
    t."id",
    COALESCE(t."public_name", t."name"),
    t."event_quota",
    t."default_event_photo_quota",
    'accepted',
    encode(gen_random_bytes(32), 'hex'),
    NOW() + INTERVAL '10 years',
    'backfill',
    true,
    t."created_at",
    t."created_at"
FROM "tenants" t
JOIN LATERAL (
    SELECT u."id" FROM "users" u
    WHERE u."tenant_id" = t."id"
    ORDER BY u."created_at" ASC
    LIMIT 1
) owner ON true
WHERE t."is_platform" = false
  AND NOT EXISTS (
      SELECT 1 FROM "tenant_contracts" c
      WHERE c."tenant_id" = t."id" AND c."is_backfill" = true
  );

-- Attach every existing event to its tenant's backfill contract. Only events that still
-- hold a slot count here: a soft-deleted event that never had a photo uploaded already
-- refunded its slot under SLOT_CONSUMED_FILTER, so it must not be attached either.
UPDATE "events" e
SET "contract_id" = c."id"
FROM "tenant_contracts" c
WHERE c."tenant_id" = e."tenant_id"
  AND c."is_backfill" = true
  AND e."contract_id" IS NULL
  AND (e."deleted_at" IS NULL OR e."photos_uploaded" > 0);
