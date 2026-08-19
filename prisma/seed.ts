import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashSync } from 'bcryptjs'
import { config } from 'dotenv'
import { PrismaClient } from '../src/generated/prisma/client'
import {
  TEMPLATE_KEYS,
  type TemplateKey,
} from '../src/shared/authorization/domain/permission-template.constants'
import { syncPermissionCatalog } from '../src/shared/authorization/infrastructure/sync-permission-catalog'

const env = process.env.NODE_ENV || 'development'
config({ path: `.env.${env}` })
config({ path: '.env' })

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SSL_MODE } = process.env

let connectionString = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
if (DB_SSL_MODE) {
  connectionString += `?sslmode=${DB_SSL_MODE}`
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

console.log(`Environment: ${env} | Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}`)

type CountryEntry = { name: string; iso_code: string }
type LocationFile = {
  country_code: string
  regions: Array<{
    code: string
    name: string
    cities: string[]
  }>
}

/**
 * Resolves the single platform tenant's id. Created by the tenant-backfill migration, so it must
 * already exist — a staff user seeded with `tenant_id = NULL` resolves to zero permissions.
 */
async function getPlatformTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findFirst({ where: { is_platform: true } })
  if (!tenant) {
    throw new Error(
      'Platform tenant not found — the TIT-38 tenant migration must run before seeding staff users',
    )
  }
  return tenant.id
}

/** Resolves a template id by key. Fails loudly if `syncPermissionCatalog()` has not run yet. */
async function getPermissionTemplateId(key: TemplateKey): Promise<string> {
  const template = await prisma.permissionTemplate.findUnique({ where: { key } })
  if (!template) {
    throw new Error(
      `Permission template '${key}' not found — syncPermissionCatalog() must run before seeding users`,
    )
  }
  return template.id
}

async function seedCountries() {
  const countriesData: CountryEntry[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed-data/countries.json'), 'utf-8'),
  )

  let count = 0
  for (const country of countriesData) {
    await prisma.country.upsert({
      where: { iso_code: country.iso_code },
      update: { name: country.name },
      create: { name: country.name, iso_code: country.iso_code },
    })
    count++
  }

  console.log(`Seeded ${count} countries`)
}

async function seedLocations() {
  const dir = path.join(__dirname, 'seed-data/locations')
  if (!fs.existsSync(dir)) {
    console.warn('seed-data/locations not found — skipping locations seed')
    return
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  let regionsCount = 0
  let citiesCount = 0
  let countriesProcessed = 0

  for (const file of files) {
    const data: LocationFile = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
    const country = await prisma.country.findUnique({
      where: { iso_code: data.country_code },
    })
    if (!country) {
      console.warn(`Country ${data.country_code} not in countries seed — skipping ${file}`)
      continue
    }

    for (const region of data.regions) {
      const upserted = await prisma.province.upsert({
        where: { code: region.code },
        update: { name: region.name, country_id: country.id },
        create: { name: region.name, code: region.code, country_id: country.id },
      })
      regionsCount++

      for (const cityName of region.cities) {
        await prisma.canton.upsert({
          where: {
            name_province_id: { name: cityName, province_id: upserted.id },
          },
          update: {},
          create: { name: cityName, province_id: upserted.id },
        })
        citiesCount++
      }
    }
    countriesProcessed++
  }

  console.log(
    `Seeded ${regionsCount} regions and ${citiesCount} cities across ${countriesProcessed} countries`,
  )
}

async function seedEventTypes() {
  const types = ['Downhill', 'Enduro', 'Ruta', 'Trail', 'Rally', 'Triatlón']

  for (const name of types) {
    await prisma.eventType.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  console.log(`Seeded ${types.length} event types`)
}

async function seedParticipantCategories() {
  const downhill = await prisma.eventType.findUnique({ where: { name: 'Downhill' } })
  if (!downhill) {
    console.log('Downhill event type not found — skipping participant categories')
    return
  }

  const categories = [
    'Pre Infantil',
    'Infantil',
    'Pre Juvenil',
    'Juvenil',
    'Damas Abiertas',
    'Damas Elite',
    'Novatos Dobles',
    'Novatos Rígidos',
    'Master A',
    'Master B',
    'Master C',
    'E-Bike',
    'Enduro A',
    'Enduro B',
    'Rígidas',
    'Elite',
    'Pro Elite',
  ]

  let count = 0
  for (const name of categories) {
    await prisma.participantCategory.upsert({
      where: { name_event_type_id: { name, event_type_id: downhill.id } },
      update: {},
      create: { name, event_type_id: downhill.id },
    })
    count++
  }

  console.log(`Seeded ${count} participant categories (Downhill)`)
}

async function seedPhotoCategories() {
  const categories = [
    'Reconocimiento de pista',
    'Entrenamientos oficiales',
    'Competencia',
    'Premiación',
    'Social',
  ]

  for (const name of categories) {
    await prisma.photoCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  console.log(`Seeded ${categories.length} photo categories`)
}

async function seedRoles() {
  for (const roleName of ['admin', 'operator', 'customer'] as const) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    })
  }
  console.log('Seeded roles: admin, operator, customer')
}

async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL
  if (!adminEmail) {
    console.log('ADMIN_SEED_EMAIL not set — skipping admin user seed')
    return
  }

  const existing = await prisma.user.findFirst({ where: { email: adminEmail } })
  if (existing) {
    console.log(`Admin user already exists: ${adminEmail}`)
    return
  }

  let password = process.env.ADMIN_SEED_PASSWORD
  let generated = false

  if (!password) {
    password = crypto.randomBytes(16).toString('base64url')
    generated = true
  }

  const passwordHash = hashSync(password, 10)

  // An admin needs the platform tenant and the platform_admin template, or it resolves to zero
  // permissions.
  const tenantId = await getPlatformTenantId()
  const templateId = await getPermissionTemplateId(TEMPLATE_KEYS.PLATFORM_ADMIN)

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      password_hash: passwordHash,
      first_name: 'Pablo',
      last_name: 'Villacres',
      is_active: true,
      tenant_id: tenantId,
      permission_template_id: templateId,
    },
  })

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } })
  if (adminRole) {
    await prisma.userRole.create({
      data: { user_id: user.id, role_id: adminRole.id },
    })
  }

  await prisma.userPhone.create({
    data: {
      user_id: user.id,
      phone_number: '+593999999999',
      label: 'Seed',
      is_whatsapp: true,
      is_primary: true,
    },
  })

  console.log(`Created admin user: ${adminEmail}`)
  if (generated) {
    console.log(`Generated password: ${password}`)
    console.log('Set ADMIN_SEED_PASSWORD env var to use a specific password.')
  }
}

async function seedProtectedUser(
  envEmailKey: string,
  envPasswordKey: string,
  roleName: 'operator' | 'customer',
  defaults: { firstName: string; lastName: string },
) {
  const email = process.env[envEmailKey]
  if (!email) {
    console.log(`${envEmailKey} not set — skipping ${roleName} user seed`)
    return
  }

  const existing = await prisma.user.findFirst({ where: { email } })
  if (existing) {
    // Ensure customer profile exists for customer users
    if (roleName === 'customer') {
      const hasProfile = await prisma.customerProfile.findFirst({ where: { user_id: existing.id } })
      if (!hasProfile) {
        const ecuador = await prisma.country.findFirst({ where: { iso_code: 'EC' } })
        if (ecuador) {
          await prisma.customerProfile.create({
            data: { user_id: existing.id, country_id: ecuador.id },
          })
          console.log(`Created customer profile for existing user: ${email}`)
        }
      }
    }
    console.log(`${roleName} user already exists: ${email}`)
    return
  }

  let password = process.env[envPasswordKey]
  let generated = false

  if (!password) {
    password = crypto.randomBytes(16).toString('base64url')
    generated = true
  }

  const passwordHash = hashSync(password, 10)

  // Operators join the platform tenant; customers stay tenant-less but still need a template.
  const templateKey =
    roleName === 'operator' ? TEMPLATE_KEYS.PLATFORM_STAFF : TEMPLATE_KEYS.CUSTOMER
  const templateId = await getPermissionTemplateId(templateKey)
  const tenantId = roleName === 'operator' ? await getPlatformTenantId() : null

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      first_name: defaults.firstName,
      last_name: defaults.lastName,
      is_active: true,
      tenant_id: tenantId,
      permission_template_id: templateId,
    },
  })

  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (role) {
    await prisma.userRole.create({
      data: { user_id: user.id, role_id: role.id },
    })
  }

  // Create customer profile for customer users (required for checkout)
  if (roleName === 'customer') {
    const ecuador = await prisma.country.findFirst({ where: { iso_code: 'EC' } })
    if (ecuador) {
      await prisma.customerProfile.create({
        data: { user_id: user.id, country_id: ecuador.id },
      })
    }
  }

  // Create default phone number for all seeded users
  await prisma.userPhone.create({
    data: {
      user_id: user.id,
      phone_number: '+593999999999',
      label: 'Seed',
      is_whatsapp: true,
      is_primary: true,
    },
  })

  console.log(`Created ${roleName} user: ${email}`)
  if (generated) {
    console.log(`Generated password: ${password}`)
  }
}

async function seedOperatorUser() {
  await seedProtectedUser('OPERATOR_SEED_EMAIL', 'OPERATOR_SEED_PASSWORD', 'operator', {
    firstName: 'Operator',
    lastName: 'TitanTV',
  })
}

async function seedConsumerUser() {
  await seedProtectedUser('CONSUMER_SEED_EMAIL', 'CONSUMER_SEED_PASSWORD', 'customer', {
    firstName: 'Consumer',
    lastName: 'TitanTV',
  })
}

/**
 * `ADMIN_SEED_EMAIL` IS the break-glass account. Marks it `is_protected = true`, idempotently.
 *
 * The tenant migration does the same, but only for users that already exist when it runs — on a
 * fresh database that step is a no-op, so this is what designates the account.
 *
 * Fails loudly (never warns) when the variable is unset or matches no user: the protected account
 * is why the TOCTOU race in the last-holder check was accepted rather than fixed, and that
 * argument only holds if the account really exists.
 */
async function seedBreakGlassProtection() {
  const targetEmail = process.env.ADMIN_SEED_EMAIL
  if (!targetEmail) {
    throw new Error(
      'ADMIN_SEED_EMAIL is not set — there is no account to designate as break-glass. ' +
        'The last-holder TOCTOU race has no compensating control without one — refusing to ' +
        'finish the seed.',
    )
  }

  const result = await prisma.user.updateMany({
    where: { email: targetEmail },
    data: { is_protected: true },
  })

  if (result.count === 0) {
    throw new Error(
      `ADMIN_SEED_EMAIL is set to '${targetEmail}' but no user has that email. ` +
        'No account would be protected — refusing to finish the seed.',
    )
  }

  await assertBreakGlassCanGrantPermissions(targetEmail)

  console.log(`Marked ${targetEmail} as break-glass protected (is_protected = true)`)
}

/**
 * Confirms the break-glass account resolves `permission.grant` to `allow`, reproducing
 * `AuthorizationService.can()`'s precedence: platformOnly first, then the global grant (the key has
 * `eventScope: false`), then template membership.
 */
async function assertBreakGlassCanGrantPermissions(email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      is_active: true,
      tenant: { select: { is_platform: true } },
      permission_template: {
        select: { key: true, permissions: { select: { permission: { select: { key: true } } } } },
      },
      permission_grants: {
        where: { scope_type: 'global', permission: { key: 'permission.grant' } },
        select: { effect: true },
      },
    },
  })

  const fail = (reason: string): never => {
    throw new Error(
      `Break-glass account ${email} cannot recover the platform: ${reason}. The last-holder ` +
        'TOCTOU race has no compensating control without it — refusing to finish the seed.',
    )
  }

  if (!user) fail('the account no longer exists')
  if (!user?.is_active) fail('the account is deactivated')
  if (!user?.tenant?.is_platform) {
    fail('it is not on the platform tenant, and permission.grant is platform-only')
  }

  const grantEffect = user?.permission_grants[0]?.effect
  if (grantEffect === 'deny') fail('an explicit global deny grant overrides its template')
  if (grantEffect === 'allow') return

  const templateKeys = (user?.permission_template?.permissions ?? []).map((p) => p.permission.key)
  if (!templateKeys.includes('permission.grant')) {
    fail(
      `its permission template ('${user?.permission_template?.key ?? 'none'}') does not include ` +
        'permission.grant',
    )
  }
}

async function main() {
  console.log('Seeding database...')

  // Same implementation the deploy path runs via `sync-permission-catalog.cli.ts`, so the seeded
  // and deployed catalogs can't drift.
  await syncPermissionCatalog(prisma)
  await seedCountries()
  await seedLocations()
  await seedEventTypes()
  await seedParticipantCategories()
  await seedPhotoCategories()
  await seedRoles()
  await seedAdminUser()
  await seedOperatorUser()
  await seedConsumerUser()
  await seedBreakGlassProtection()

  console.log('Seeding completed.')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
