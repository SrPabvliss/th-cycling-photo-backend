import { createHmac, randomBytes } from 'node:crypto'
import type { PrismaClient } from '@generated/prisma/client'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'
import { STORAGE_ADAPTER } from '../src/shared/storage/domain/ports/storage-adapter.port'
import { createAuthenticatedUser, type TestAuthUser } from './fixtures/factories/auth.factory'
import { ensurePaymentSystemUser } from './fixtures/factories/payment-system-user.factory'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createEventFixture } from './fixtures/factories/user.factory'

interface DeliveredPhotoBody {
  id: string
  filename: string
  fileSize: number
  downloadUrl: string
  thumbnailUrl: string | null
}

const THUMBNAIL_LIFETIME_SECONDS = 3600

describe('Delivered photos carry thumbnails (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let eventId: string
  let orderId: string
  let cdnUrl: string
  let hmacSecret: string

  const token = randomBytes(32).toString('hex')
  const photoIds: Record<'original' | 'retouched' | 'retouchedWithoutSlug', string> = {
    original: '',
    retouched: '',
    retouchedWithoutSlug: '',
  }
  const slugs = { original: '', retouched: `rt-${randomBytes(6).toString('hex')}` }

  const storageStub = {
    getPresignedDownloadUrl: jest.fn(
      async ({ key }: { key: string }) => `https://b2.test/${encodeURIComponent(key)}`,
    ),
  }

  function expectSignedThumbnail(url: string | null, slug: string, requestedAtSeconds: number) {
    expect(url).not.toBeNull()
    const parsed = new URL(url as string)
    const pathname = `/internal/thumb/${slug}.jpg`

    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${cdnUrl}${pathname}`)

    const [expiration, hmac] = (parsed.searchParams.get('token') ?? '').split('-')
    const lifetime = Number(expiration) - requestedAtSeconds
    expect(lifetime).toBeGreaterThanOrEqual(THUMBNAIL_LIFETIME_SECONDS - 5)
    expect(lifetime).toBeLessThanOrEqual(THUMBNAIL_LIFETIME_SECONDS + 60)
    // Same signature the Worker recomputes before serving: HMAC of pathname + expiration.
    expect(hmac).toBe(
      createHmac('sha256', hmacSecret).update(`${pathname}${expiration}`).digest('hex'),
    )
  }

  function expectDeliveredPhotos(photos: DeliveredPhotoBody[], requestedAtSeconds: number) {
    const byId = new Map(photos.map((photo) => [photo.id, photo]))
    expect(byId.size).toBe(3)

    expectSignedThumbnail(
      byId.get(photoIds.original)?.thumbnailUrl ?? null,
      slugs.original,
      requestedAtSeconds,
    )
    // A retouched delivery shows the retouched file, never the original it replaced.
    expectSignedThumbnail(
      byId.get(photoIds.retouched)?.thumbnailUrl ?? null,
      slugs.retouched,
      requestedAtSeconds,
    )
    // The delivered file has no CDN slug: no thumbnail, and the photo is still downloadable.
    const withoutSlug = byId.get(photoIds.retouchedWithoutSlug)
    expect(withoutSlug?.thumbnailUrl).toBeNull()
    expect(withoutSlug?.downloadUrl).toContain('retouched-noslug')

    for (const photo of photos) {
      expect(photo.downloadUrl).toMatch(/^https:\/\/b2\.test\//)
      expect(photo.thumbnailUrl ?? '').not.toContain('/gallery/')
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE_ADAPTER)
      .useValue(storageStub)
      .compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    app.useGlobalFilters(new GlobalExceptionFilter())
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    await ensurePaymentSystemUser(moduleFixture.get(PrismaService))
    await app.init()

    prisma = moduleFixture.get(PrismaService)
    const config = moduleFixture.get(ConfigService)
    cdnUrl = config.getOrThrow<string>('storage.cdnUrl')
    hmacSecret = config.getOrThrow<string>('cloudflare.hmacSecret')

    buyer = await createAuthenticatedUser(
      prisma as never,
      moduleFixture.get(JwtService),
      'customer',
    )
    eventId = await createEventFixture(prisma as unknown as PrismaClient)

    photoIds.original = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    photoIds.retouched = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    photoIds.retouchedWithoutSlug = await createPhotoFixture(
      prisma as unknown as PrismaClient,
      eventId,
    )

    slugs.original = (
      await prisma.photo.findUniqueOrThrow({
        where: { id: photoIds.original },
        select: { public_slug: true },
      })
    ).public_slug
    await prisma.photo.update({
      where: { id: photoIds.retouched },
      data: {
        retouched_storage_key: `events/${eventId}/retouched/with-slug.jpg`,
        retouched_file_size: BigInt(2048),
        retouched_public_slug: slugs.retouched,
      },
    })
    await prisma.photo.update({
      where: { id: photoIds.retouchedWithoutSlug },
      data: {
        retouched_storage_key: `events/${eventId}/retouched/retouched-noslug.jpg`,
        retouched_file_size: BigInt(4096),
        retouched_public_slug: null,
      },
    })

    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status: 'delivered',
        snap_first_name: 'Ana',
        snap_last_name: 'Rider',
        items: {
          create: [
            { photo_id: photoIds.original, delivered_as: 'original' },
            { photo_id: photoIds.retouched, delivered_as: 'retouched' },
            { photo_id: photoIds.retouchedWithoutSlug, delivered_as: 'retouched' },
          ],
        },
      },
    })
    orderId = order.id

    await prisma.deliveryLink.create({
      data: {
        order_id: orderId,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  })

  afterAll(async () => {
    if (orderId) {
      await prisma.deliveryLink.deleteMany({ where: { order_id: orderId } })
      await prisma.orderItem.deleteMany({ where: { order_id: orderId } })
      await prisma.order.deleteMany({ where: { id: orderId } })
    }
    await prisma.photo.deleteMany({
      where: { id: { in: Object.values(photoIds).filter(Boolean) } },
    })
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } })
    if (buyer) {
      await prisma.userRole.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.user.deleteMany({ where: { id: buyer.userId } })
    }
    await app.close()
  })

  it('GET /orders/me/:id/downloads gives each photo a signed, watermark-free thumbnail', async () => {
    const requestedAt = Math.floor(Date.now() / 1000)

    const res = await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${orderId}/downloads`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200)

    expect(res.body.data.orderId).toBe(orderId)
    expectDeliveredPhotos(res.body.data.photos, requestedAt)
  })

  it('GET /delivery/:token gives the same thumbnails and spends exactly one access', async () => {
    const before = await prisma.deliveryLink.findUniqueOrThrow({ where: { token } })
    expect(before.download_count).toBe(0)
    const requestedAt = Math.floor(Date.now() / 1000)

    const res = await request(app.getHttpServer()).get(`/api/v1/delivery/${token}`).expect(200)

    expectDeliveredPhotos(res.body.data.photos, requestedAt)
    // Anyone holding the link sees it, and links get forwarded: the buyer's name is not in it.
    expect(res.body.data).not.toHaveProperty('customerName')
    expect(JSON.stringify(res.body.data)).not.toMatch(/Rider|snap_/)

    const after = await prisma.deliveryLink.findUniqueOrThrow({ where: { token } })
    expect(after.download_count).toBe(1)
  })
})
