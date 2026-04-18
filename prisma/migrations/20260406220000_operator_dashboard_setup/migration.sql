-- RenameEnumValue: classifier → operator
-- Add the new value to existing enum, migrate data, then remove old value
ALTER TYPE "role_type" ADD VALUE IF NOT EXISTS 'operator';

UPDATE "roles" SET "name" = 'operator' WHERE "name" = 'classifier';

-- Now swap to clean enum without 'classifier'
BEGIN;
CREATE TYPE "role_type_new" AS ENUM ('admin', 'operator', 'customer');
ALTER TABLE "roles" ALTER COLUMN "name" TYPE "role_type_new" USING ("name"::text::"role_type_new");
ALTER TYPE "role_type" RENAME TO "role_type_old";
ALTER TYPE "role_type_new" RENAME TO "role_type";
DROP TYPE "public"."role_type_old";
COMMIT;

-- AlterTable: add retouched_by_id to photos
ALTER TABLE "photos" ADD COLUMN "retouched_by_id" UUID;

-- CreateTable: event_operators
CREATE TABLE "event_operators" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" UUID NOT NULL,

    CONSTRAINT "event_operators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_operators_event_id_idx" ON "event_operators"("event_id");
CREATE INDEX "event_operators_user_id_idx" ON "event_operators"("user_id");
CREATE INDEX "event_operators_assigned_by_id_idx" ON "event_operators"("assigned_by_id");
CREATE UNIQUE INDEX "event_operators_event_id_user_id_key" ON "event_operators"("event_id", "user_id");
CREATE INDEX "photos_retouched_by_id_idx" ON "photos"("retouched_by_id");

-- AddForeignKey
ALTER TABLE "event_operators" ADD CONSTRAINT "event_operators_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_operators" ADD CONSTRAINT "event_operators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_operators" ADD CONSTRAINT "event_operators_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "photos" ADD CONSTRAINT "photos_retouched_by_id_fkey" FOREIGN KEY ("retouched_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
