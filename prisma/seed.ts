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

async function seedDemoData() {
  // Find Tungurahua province and Ambato canton for demo event
  const tungurahua = await prisma.province.findFirst({ where: { code: 'EC-T' } })
  const ambato = tungurahua
    ? await prisma.canton.findFirst({ where: { name: 'Ambato', province_id: tungurahua.id } })
    : null

  // Upsert demo event
  const eventName = 'Vuelta Ciclística del Ecuador 2026'
  const existingEvent = await prisma.event.findFirst({ where: { name: eventName } })
  if (existingEvent) {
    console.log(`Demo event already exists: ${eventName}`)
    return
  }

  const downhill = await prisma.eventType.findUnique({ where: { name: 'Downhill' } })

  const slugify = (await import('slugify')).default
  const event = await prisma.event.create({
    data: {
      name: eventName,
      slug: slugify(eventName, { lower: true, strict: true, locale: 'es' }),
      event_date: new Date('2026-03-15'),
      event_type_id: downhill!.id,
      province_id: tungurahua?.id ?? null,
      canton_id: ambato?.id ?? null,
      status: 'active',
    },
  })
  console.log(`Created event: ${event.name}`)

  // Create 10 photos
  const photos = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.photo.create({
        data: {
          event_id: event.id,
          filename: `IMG_${String(i + 1).padStart(4, '0')}.jpg`,
          storage_key: `events/${event.id}/photos/IMG_${String(i + 1).padStart(4, '0')}.jpg`,
          file_size: BigInt(Math.floor(Math.random() * 5_000_000) + 1_000_000),
          mime_type: 'image/jpeg',
          width: 4032,
          height: 3024,
          public_slug: crypto.randomBytes(11).toString('base64url'),
          status: 'pending',
          captured_at: new Date(`2026-03-15T${String(8 + i).padStart(2, '0')}:00:00Z`),
        },
      }),
    ),
  )
  console.log(`Created ${photos.length} photos`)
}

async function seedCommercialFlowData() {
  const event = await prisma.event.findFirst({
    where: { name: 'Vuelta Ciclística del Ecuador 2026' },
  })
  if (!event) {
    console.log('Demo event not found — skipping commercial flow seed')
    return
  }

  const adminUser = await prisma.user.findFirst({
    where: { user_roles: { some: { role: { name: 'admin' } } } },
  })
  if (!adminUser) {
    console.log('No admin user found — skipping commercial flow seed')
    return
  }

  // Check if demo order already exists
  const existingOrder = await prisma.order.findFirst({ where: { event_id: event.id } })
  if (existingOrder) {
    console.log('Commercial flow data already exists — skipping')
    return
  }

  const photos = await prisma.photo.findMany({
    where: { event_id: event.id },
    take: 5,
    orderBy: { uploaded_at: 'asc' },
  })
  if (photos.length === 0) {
    console.log('No photos found — skipping commercial flow seed')
    return
  }

  // 1. PreviewLink with photos
  const previewLink = await prisma.previewLink.create({
    data: {
      token: crypto.randomBytes(32).toString('hex'),
      event_id: event.id,
      status: 'converted',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      viewed_at: new Date(),
      created_by_id: adminUser.id,
      photos: {
        create: photos.map((photo) => ({ photo_id: photo.id })),
      },
    },
  })

  // 2. Order (user_id = admin user for demo)
  const selectedPhotos = photos.slice(0, 3)
  const order = await prisma.order.create({
    data: {
      preview_link_id: previewLink.id,
      event_id: event.id,
      user_id: adminUser.id,
      status: 'paid',
      paid_at: new Date(),
      confirmed_by_id: adminUser.id,
      snap_first_name: adminUser.first_name,
      snap_last_name: adminUser.last_name,
      snap_email: adminUser.email,
      items: {
        create: selectedPhotos.map((photo) => ({ photo_id: photo.id })),
      },
    },
  })

  // 3. DeliveryLink
  await prisma.deliveryLink.create({
    data: {
      order_id: order.id,
      token: crypto.randomBytes(32).toString('hex'),
      status: 'active',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  })

  console.log(
    'Seeded commercial flow: 1 preview link (5 photos), 1 order (3 items), 1 delivery link',
  )
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
  await seedDemoData()
  await seedCommercialFlowData()

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
