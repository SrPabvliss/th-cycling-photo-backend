INSERT INTO tenants (id, name, is_platform, created_at) 
VALUES (gen_random_uuid(), 'Test Tenant', false, NOW())
ON CONFLICT DO NOTHING;

INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, tenant_id, permission_template_id, created_at)
SELECT 
  gen_random_uuid(), 
  'tenant@test.com', 
  '$2b$10$tZ2R1/J1Y0/Y0/Y0/Y0/Y0/Y0/Y0/Y0/Y0/Y0/Y0/Y0/Y0/Y0', 
  'Test', 
  'Tenant', 
  true, 
  t.id, 
  pt.id, 
  NOW()
FROM tenants t
JOIN permission_templates pt ON pt.key = 'tenant'
WHERE t.name = 'Test Tenant'
ON CONFLICT (email) DO NOTHING;

INSERT INTO events (id, name, slug, start_date, end_date, event_type_id, tenant_id, status, created_at)
SELECT 
  gen_random_uuid(), 
  'Test Tenant Event', 
  'test-tenant-event', 
  NOW(), 
  NOW(), 
  (SELECT id FROM event_types LIMIT 1), 
  t.id, 
  'active', 
  NOW()
FROM tenants t
WHERE t.name = 'Test Tenant'
ON CONFLICT (slug) DO NOTHING;
