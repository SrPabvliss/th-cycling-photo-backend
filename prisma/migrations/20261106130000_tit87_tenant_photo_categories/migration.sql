-- TIT-87: photo categories become either BASE (tenant_id NULL: global, every tenant may pick them,
-- only the platform manages them) or OWN (tenant_id set: that tenant's private categories).
--
-- The BASE list below is the dev one. Before deploying, read production's categories
-- (SELECT id, name FROM photo_categories ORDER BY id;) and adjust the NOT IN list.
--
-- Every category outside the BASE list becomes Titan TV's (the platform tenant). Any other tenant
-- already using one of them, through an event assignment or a photo, gets its own copy, and that
-- tenant's assignments and photos are remapped to it. The final check aborts the whole migration
-- if any assignment or photo is left on a category owned by a different tenant.
BEGIN;

ALTER TABLE "photo_categories" ADD COLUMN "tenant_id" UUID NULL;
ALTER TABLE "photo_categories"
  ADD CONSTRAINT "photo_categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "photo_categories_tenant_id_idx" ON "photo_categories"("tenant_id");

DROP INDEX "photo_categories_name_key";
-- One name per owner, case-insensitive; NULLS NOT DISTINCT makes the base set one owner too.
CREATE UNIQUE INDEX "photo_categories_owner_name_key"
  ON "photo_categories" ("tenant_id", lower("name")) NULLS NOT DISTINCT;

UPDATE "photo_categories"
SET "tenant_id" = (SELECT "id" FROM "tenants" WHERE "is_platform" LIMIT 1)
WHERE "name" NOT IN (
  'Reconocimiento de pista',
  'Entrenamientos oficiales',
  'Competencia',
  'Premiación',
  'Social'
);

CREATE TEMP TABLE "_tit87_category_use" ON COMMIT DROP AS
SELECT DISTINCT pc."id" AS "old_id", pc."name", e."tenant_id"
FROM "photo_categories" pc
JOIN (
  SELECT "event_id", "photo_category_id" FROM "event_photo_categories"
  UNION
  SELECT "event_id", "photo_category_id" FROM "photos" WHERE "photo_category_id" IS NOT NULL
) used ON used."photo_category_id" = pc."id"
JOIN "events" e ON e."id" = used."event_id"
WHERE pc."tenant_id" IS NOT NULL AND e."tenant_id" <> pc."tenant_id";

INSERT INTO "photo_categories" ("name", "tenant_id", "created_at")
SELECT "name", "tenant_id", now() FROM "_tit87_category_use";

UPDATE "event_photo_categories" epc
SET "photo_category_id" = copy."id"
FROM "_tit87_category_use" u
JOIN "photo_categories" copy ON copy."tenant_id" = u."tenant_id" AND copy."name" = u."name",
     "events" e
WHERE epc."photo_category_id" = u."old_id"
  AND e."id" = epc."event_id"
  AND e."tenant_id" = u."tenant_id";

UPDATE "photos" p
SET "photo_category_id" = copy."id"
FROM "_tit87_category_use" u
JOIN "photo_categories" copy ON copy."tenant_id" = u."tenant_id" AND copy."name" = u."name",
     "events" e
WHERE p."photo_category_id" = u."old_id"
  AND e."id" = p."event_id"
  AND e."tenant_id" = u."tenant_id";

DO $$
DECLARE
  foreign_assignments INTEGER;
  foreign_photos INTEGER;
BEGIN
  SELECT count(*) INTO foreign_assignments
  FROM "event_photo_categories" epc
  JOIN "photo_categories" pc ON pc."id" = epc."photo_category_id"
  JOIN "events" e ON e."id" = epc."event_id"
  WHERE pc."tenant_id" IS NOT NULL AND pc."tenant_id" <> e."tenant_id";

  SELECT count(*) INTO foreign_photos
  FROM "photos" p
  JOIN "photo_categories" pc ON pc."id" = p."photo_category_id"
  JOIN "events" e ON e."id" = p."event_id"
  WHERE pc."tenant_id" IS NOT NULL AND pc."tenant_id" <> e."tenant_id";

  IF foreign_assignments > 0 OR foreign_photos > 0 THEN
    RAISE EXCEPTION 'TIT-87: % event assignments and % photos still point at another tenant category',
      foreign_assignments, foreign_photos;
  END IF;
END $$;

COMMIT;
