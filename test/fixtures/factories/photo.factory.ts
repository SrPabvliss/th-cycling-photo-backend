import type { PrismaClient } from '@generated/prisma/client'

export async function createPhotoFixture(prisma: PrismaClient, eventId: string): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const photo = await prisma.photo.create({
    data: {
      event_id: eventId,
      filename: `test-${suffix}.jpg`,
      storage_key: `events/${eventId}/photos/test-${suffix}.jpg`,
      public_slug: `slug-${Math.random().toString(36).slice(2, 12)}`,
      file_size: BigInt(1024),
      mime_type: 'image/jpeg',
      status: 'pending',
    },
    select: { id: true },
  })
  return photo.id
}
