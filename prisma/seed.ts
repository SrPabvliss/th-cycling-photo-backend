import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { EventStatus, PhotoStatus, PrismaClient } from '@prisma/client'
import pg from 'pg'

// Use direct PostgreSQL connection for seeding (via Prisma dev server)
const connectionString = 'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable'
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main(): Promise<void> {
  console.log('Seeding database...')

  // Clean existing data first (in reverse order of dependencies)
  await prisma.photo.deleteMany({})
  await prisma.event.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('Cleaned existing data')

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'admin@cyclingphotos.test',
      password_hash: '$2b$10$placeholder.hash.for.testing.only',
    },
  })
  console.log(`Created user: ${user.email}`)

  // Create test event
  const event = await prisma.event.create({
    data: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Vuelta Ciclística Ecuador 2026',
      event_date: new Date('2026-03-15'),
      location: 'Ambato, Ecuador',
      status: EventStatus.processing,
      total_photos: 10,
      processed_photos: 5,
      exported_photos: 0,
    },
  })
  console.log(`Created event: ${event.name}`)

  // Photo statuses distribution for testing
  const photoConfigs: Array<{
    status: PhotoStatus
    unclassified_reason?: 'no_cyclist' | 'ocr_failed' | 'low_confidence' | 'processing_error'
  }> = [
    { status: PhotoStatus.pending },
    { status: PhotoStatus.pending },
    { status: PhotoStatus.detecting },
    { status: PhotoStatus.analyzing },
    { status: PhotoStatus.completed },
    { status: PhotoStatus.completed },
    { status: PhotoStatus.completed },
    { status: PhotoStatus.failed, unclassified_reason: 'no_cyclist' },
    { status: PhotoStatus.failed, unclassified_reason: 'ocr_failed' },
    { status: PhotoStatus.failed, unclassified_reason: 'processing_error' },
  ]

  // Create 10 test photos
  for (let i = 0; i < 10; i++) {
    const config = photoConfigs[i]
    const photoNumber = String(i + 1).padStart(4, '0')

    await prisma.photo.create({
      data: {
        event_id: event.id,
        filename: `IMG_${photoNumber}.jpg`,
        storage_key: `events/${event.id}/photos/IMG_${photoNumber}.jpg`,
        file_size: BigInt(Math.floor(Math.random() * 5000000) + 1000000), // 1-6 MB
        mime_type: 'image/jpeg',
        width: 4000,
        height: 3000,
        status: config.status,
        unclassified_reason: config.unclassified_reason,
        captured_at: new Date(`2026-03-15T${10 + i}:00:00Z`),
        processed_at: config.status === PhotoStatus.completed ? new Date() : null,
      },
    })
  }
  console.log('Created 10 test photos')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
