-- AlterTable
ALTER TABLE "users" ADD COLUMN     "permission_template_id" UUID;

-- CreateTable
CREATE TABLE "permission_templates" (
    "id" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_platform_only" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permission_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_template_permissions" (
    "template_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "permission_template_permissions_pkey" PRIMARY KEY ("template_id","permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_templates_key_key" ON "permission_templates"("key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_permission_template_id_fkey" FOREIGN KEY ("permission_template_id") REFERENCES "permission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_template_permissions" ADD CONSTRAINT "permission_template_permissions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "permission_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_template_permissions" ADD CONSTRAINT "permission_template_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the four template rows so the FK targets below exist. Membership
-- (which permissions belong to each template) is not seeded here —
-- seedPermissionTemplates() owns that and runs immediately after
-- seedPermissions() in prisma/seed.ts. This INSERT only needs the rows to
-- exist so users.permission_template_id can resolve.
INSERT INTO permission_templates (id, key, name, is_platform_only) VALUES
  (gen_random_uuid(), 'platform_admin', 'TitanTV Administrator', true),
  (gen_random_uuid(), 'platform_staff', 'TitanTV Staff',         true),
  (gen_random_uuid(), 'tenant',         'Tenant',                false),
  (gen_random_uuid(), 'customer',       'Customer',              false)
ON CONFLICT (key) DO NOTHING;

-- Assign templates to every existing user so behaviour is preserved exactly.
-- admin wins over operator if a user somehow holds both, matching
-- user_roles[0] behaviour closely enough that no user loses access.
UPDATE users u SET permission_template_id = (SELECT id FROM permission_templates WHERE key = 'platform_admin')
WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id AND r.name = 'admin');

UPDATE users u SET permission_template_id = (SELECT id FROM permission_templates WHERE key = 'platform_staff')
WHERE permission_template_id IS NULL
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id AND r.name = 'operator');

UPDATE users u SET permission_template_id = (SELECT id FROM permission_templates WHERE key = 'customer')
WHERE permission_template_id IS NULL;
