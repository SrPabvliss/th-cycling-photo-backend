import { PrismaClient } from './src/generated/prisma/client'
import { hashSync } from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.development' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const tenantTpl = await prisma.permissionTemplate.findUnique({ where: { key: 'tenant' } })
  if (!tenantTpl) {
    console.log("Tenant template not found! Run seed/migrations first.")
    return
  }

  const tenantName = 'My Test Tenant'
  let tenant = await prisma.tenant.findFirst({ where: { name: tenantName } })
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { name: tenantName, is_platform: false } })
    console.log("Created Tenant:", tenant.name)
  }

  const email = 'tenant@test.com'
  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const password_hash = hashSync('123456', 10)
    user = await prisma.user.create({
      data: {
        email,
        password_hash,
        first_name: 'Test',
        last_name: 'Tenant',
        is_active: true,
        tenant_id: tenant.id,
        permission_template_id: tenantTpl.id,
      }
    })
    console.log(`Created Tenant User! Email: ${email} Password: 123456`)
  } else {
    console.log(`Tenant User already exists! Email: ${email} Password: 123456`)
  }

  // Also create a test event for this tenant
  const evtType = await prisma.eventType.findFirst()
  if (evtType) {
    const evt = await prisma.event.findFirst({ where: { slug: 'test-tenant-event' } })
    if (!evt) {
      await prisma.event.create({
        data: {
          name: 'Test Tenant Event',
          slug: 'test-tenant-event',
          start_date: new Date(),
          end_date: new Date(),
          tenant_id: tenant.id,
          event_type_id: evtType.id,
        }
      })
      console.log("Created Test Event for the tenant")
    }
  }
}

main().catch(console.error).finally(() => {
  prisma.$disconnect()
  pool.end()
})
