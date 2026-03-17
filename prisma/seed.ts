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

type ProvinceEntry = { name: string; code: string }
type CantonsByProvince = Record<string, string[]>

async function seedLocations() {
  const provincesData: ProvinceEntry[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed-data/provinces.json'), 'utf-8'),
  )
  const cantonsData: CantonsByProvince = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed-data/cantons.json'), 'utf-8'),
  )

  let provincesCount = 0
  let cantonsCount = 0

  for (const province of provincesData) {
    const upserted = await prisma.province.upsert({
      where: { code: province.code },
      update: { name: province.name },
      create: { name: province.name, code: province.code },
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

async function seedRoles() {
  for (const roleName of ['admin', 'classifier'] as const) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    })
  }
  console.log('Seeded roles: admin, classifier')
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

  const event = await prisma.event.create({
    data: {
      name: eventName,
      event_date: new Date('2026-03-15'),
      location: 'Ambato, Ecuador',
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
          status: 'pending',
          captured_at: new Date(`2026-03-15T${String(8 + i).padStart(2, '0')}:00:00Z`),
        },
      }),
    ),
  )
  console.log(`Created ${photos.length} photos`)
}

async function main() {
  console.log('Seeding database...')

  await seedLocations()
  await seedRoles()
  await seedAdminUser()
  await seedDemoData()

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
