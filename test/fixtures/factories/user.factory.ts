import type { PrismaClient } from '@generated/prisma/client'
import { getPlatformTenantId } from './tenant.factory'

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
  const tenantId = await getPlatformTenantId(prisma)

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const event = await prisma.event.create({
    data: {
      name: `Test Event ${suffix}`,
      slug: `test-event-${suffix}`,
      start_date: new Date(),
      end_date: new Date(),
      event_type_id: eventType.id,
      tenant_id: tenantId,
    },
    select: { id: true },
  })
  return event.id
}

/**
 * An event on public sale: active with a cover image, so the cart sells its photos. The cover is
 * removed with the event (cascade).
 */
export async function createOnSaleEventFixture(prisma: PrismaClient): Promise<string> {
  const eventId = await createEventFixture(prisma)
  await prisma.eventAsset.create({
    data: {
      event_id: eventId,
      asset_type: 'cover_image',
      storage_key: `events/${eventId}/cover.jpg`,
      public_slug: `cover-${Math.random().toString(36).slice(2, 14)}`,
    },
  })
  return eventId
}
