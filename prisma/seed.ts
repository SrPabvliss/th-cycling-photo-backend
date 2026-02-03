import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { PrismaClient } from '../generated/prisma/client'

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

async function main() {
  console.log('Seeding database...')

  // Clean existing data in dependency order
  await prisma.equipmentColor.deleteMany()
  await prisma.plateNumber.deleteMany()
  await prisma.detectedCyclist.deleteMany()
  await prisma.processingJob.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.event.deleteMany()
  await prisma.user.deleteMany()

  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'admin@cyclingphoto.dev',
      password_hash: '$2b$10$placeholder_hash_for_seed_data_only',
    },
  })
  console.log(`Created user: ${user.email}`)

  // Create event
  const event = await prisma.event.create({
    data: {
      name: 'Vuelta Ciclística del Ecuador 2026',
      event_date: new Date('2026-03-15'),
      location: 'Ambato, Ecuador',
      status: 'draft',
      total_photos: 10,
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
