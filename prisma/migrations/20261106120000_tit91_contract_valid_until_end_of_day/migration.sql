-- TIT-91: contracts issued before the fix stored `valid_until` as UTC midnight of the picked day
-- (the global pipe's implicit conversion ran before the DTO transform), which is the previous
-- evening in Ecuador. Move each one to the last instant of that same day in Ecuador.
--
-- Only rows sitting exactly on UTC midnight are touched: a correctly issued contract ends at
-- 23:59:59.999 Ecuador time (04:59:59.999 UTC) and a backfill one at an arbitrary NOW() + 10 years.
-- Idempotent: once moved, a row no longer sits on UTC midnight.
--
-- Before running in production, read what it will touch:
--   SELECT id, valid_until, is_backfill FROM tenant_contracts
--   WHERE ("valid_until" AT TIME ZONE 'UTC')::time = '00:00:00';
UPDATE "tenant_contracts"
SET "valid_until" = (("valid_until" AT TIME ZONE 'UTC')::date + TIME '23:59:59.999') AT TIME ZONE 'America/Guayaquil'
WHERE "is_backfill" = false
  AND ("valid_until" AT TIME ZONE 'UTC')::time = '00:00:00';
