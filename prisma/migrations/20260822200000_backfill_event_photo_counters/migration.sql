-- TIT-43 added `events.photos_uploaded` with a default of 0. It is a
-- consumption counter charged when a photo batch is confirmed, and it is
-- never decremented, so on a database that already holds photos the default
-- understates every event by its entire history.
--
-- Production carries ~11k photos across 10 events, all of which would read 0.
-- That misreports the uploaded count in the event views and, through
-- `SLOT_CONSUMED_FILTER`, would let a deleted event with photos stop
-- consuming a tenant's event slot.
--
-- Photos are hard-deleted, so `count(*)` is the closest available reading of
-- "photos ever charged to this event". Only events still sitting at 0 are
-- touched, which makes this a no-op on any database that never had photos
-- before the counter existed.
UPDATE "events" e
SET "photos_uploaded" = sub."total"
FROM (
  SELECT "event_id", count(*)::int AS "total"
  FROM "photos"
  GROUP BY "event_id"
) sub
WHERE sub."event_id" = e."id"
  AND e."photos_uploaded" = 0;
