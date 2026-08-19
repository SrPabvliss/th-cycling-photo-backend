/*
  Warnings:

  - You are about to drop the `event_operators` table. If the table is not empty, all the data it contains will be lost.

*/
-- Migrate EventOperator assignments to user_permission_grants for retouching permissions
INSERT INTO "user_permission_grants" (
  "id", 
  "user_id", 
  "permission_id", 
  "scope_type", 
  "event_id", 
  "effect", 
  "granted_by_id", 
  "granted_at"
)
SELECT 
  gen_random_uuid(),
  eo."user_id",
  p."id",
  'event'::"grant_scope_type",
  eo."event_id",
  'allow'::"grant_effect",
  eo."assigned_by_id",
  eo."assigned_at"
FROM "event_operators" eo
CROSS JOIN "permissions" p
WHERE p."key" IN ('photo.retouch.read', 'photo.retouch.upload', 'photo.retouch.flag', 'dashboard.operator.read')
ON CONFLICT DO NOTHING;

-- DropForeignKey
ALTER TABLE "event_operators" DROP CONSTRAINT "event_operators_assigned_by_id_fkey";

-- DropForeignKey
ALTER TABLE "event_operators" DROP CONSTRAINT "event_operators_event_id_fkey";

-- DropForeignKey
ALTER TABLE "event_operators" DROP CONSTRAINT "event_operators_user_id_fkey";

-- DropTable
DROP TABLE "event_operators";
