import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashSync } from 'bcryptjs'
import { config } from 'dotenv'
import { PrismaClient } from '../src/generated/prisma/client'

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
type ProvinceEntry = { name: string; code: string }
type CantonsByProvince = Record<string, string[]>

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
  const provincesData: ProvinceEntry[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed-data/provinces.json'), 'utf-8'),
  )
  const cantonsData: CantonsByProvince = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed-data/cantons.json'), 'utf-8'),
  )

  const ecuador = await prisma.country.findFirst({ where: { iso_code: 'EC' } })

  let provincesCount = 0
  let cantonsCount = 0

  for (const province of provincesData) {
    const upserted = await prisma.province.upsert({
      where: { code: province.code },
      update: { name: province.name, country_id: ecuador!.id },
      create: { name: province.name, code: province.code, country_id: ecuador!.id },
    })

    provincesCount++

    const cantonNames = cantonsData[province.code] || []
    for (const cantonName of cantonNames) {
      await prisma.canton.upsert({
        where: {
          id: await prisma.canton
            .findFirst({
              where: { name: cantonName, province_id: upserted.id },
              select: { id: true },
            })
            .then((c) => c?.id ?? 0),
        },
        update: { name: cantonName },
        create: { name: cantonName, province_id: upserted.id },
      })
      cantonsCount++
    }
  }

  console.log(`Seeded ${provincesCount} provinces and ${cantonsCount} cantons`)
}

async function seedEventTypes() {
  const types = ['Downhill', 'Ruta', 'Trail', 'Rally', 'Triatlón']

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

async function seedGearTypes() {
  const downhill = await prisma.eventType.findUnique({ where: { name: 'Downhill' } })
  if (!downhill) {
    console.log('Downhill event type not found — skipping gear types')
    return
  }

  const gearTypes = ['headwear', 'clothing', 'vehicle']

  for (const name of gearTypes) {
    await prisma.gearType.upsert({
      where: { name_event_type_id: { name, event_type_id: downhill.id } },
      update: {},
      create: { name, event_type_id: downhill.id },
    })
  }

  console.log(`Seeded ${gearTypes.length} gear types (Downhill)`)
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

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      password_hash: passwordHash,
      first_name: 'Pablo',
      last_name: 'Villacres',
      is_active: true,
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

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      first_name: defaults.firstName,
      last_name: defaults.lastName,
      is_active: true,
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

async function main() {
  console.log('Seeding database...')

  await seedCountries()
  await seedLocations()
  await seedEventTypes()
  await seedParticipantCategories()
  await seedGearTypes()
  await seedPhotoCategories()
  await seedRoles()
  await seedAdminUser()
  await seedOperatorUser()
  await seedConsumerUser()

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
