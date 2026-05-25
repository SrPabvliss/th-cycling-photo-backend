import type { PrismaClient } from '@generated/prisma/client'

/**
 * Creates a minimal User fixture. Adjusts to actual schema:
 * - email (unique), password_hash (required), first_name/last_name optional.
 */
export async function createUserFixture(prisma: PrismaClient): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const user = await prisma.user.create({
    data: {
      email: `test-${suffix}@example.com`,
      password_hash: 'test-hash-not-real',
      first_name: 'Test',
      last_name: 'User',
    },
    select: { id: true },
  })
  return user.id
}

/**
 * Creates a minimal Event fixture, upserting the required EventType.
 * Schema requires: name, slug (unique), start_date+end_date (Date), event_type_id (FK Int).
 */
export async function createEventFixture(prisma: PrismaClient): Promise<string> {
  const eventType = await prisma.eventType.upsert({
    where: { name: 'road_race' },
    update: {},
    create: { name: 'road_race' },
    select: { id: true },
  })

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const event = await prisma.event.create({
    data: {
      name: `Test Event ${suffix}`,
      slug: `test-event-${suffix}`,
      start_date: new Date(),
      end_date: new Date(),
      event_type_id: eventType.id,
    },
    select: { id: true },
  })
  return event.id
}
