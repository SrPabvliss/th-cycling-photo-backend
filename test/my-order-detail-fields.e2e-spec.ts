import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@generated/prisma/client'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'
import { createAuthenticatedUser, type TestAuthUser } from './fixtures/factories/auth.factory'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createEventFixture } from './fixtures/factories/user.factory'

describe('My order detail: payment method and event gallery (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  const eventIds: string[] = []
  const orderIds: string[] = []

  const db = () => prisma as unknown as PrismaClient
  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', `Bearer ${buyer.token}`)

  async function createEvent(withCover: boolean): Promise<{ id: string; slug: string }> {
    const eventId = await createEventFixture(db())
    eventIds.push(eventId)
    if (withCover) {
      const assetSlug = randomUUID().replace(/-/g, '').slice(0, 30)
      await prisma.eventAsset.create({
        data: {
          event_id: eventId,
          asset_type: 'cover_image',
          storage_key: `events/${eventId}/${assetSlug}.jpg`,
          public_slug: assetSlug,
        },
      })
    }
    const { slug } = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    return { id: eventId, slug }
  }

  async function createPendingTransferOrder(eventId: string): Promise<string> {
    const photoId = await createPhotoFixture(db(), eventId)
    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status: 'pending',
        payment_method: 'transfer',
        subtotal: '8.00',
        snap_currency: 'USD',
        items: { create: [{ photo_id: photoId, unit_price: '8.00' }] },
      },
    })
    orderIds.push(order.id)
    return order.id
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

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
    prisma = moduleFixture.get(PrismaService)
    await app.init()

    buyer = await createAuthenticatedUser(db(), moduleFixture.get(JwtService), 'customer')
  })

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    await prisma.photo.deleteMany({ where: { event_id: { in: eventIds } } })
    await prisma.eventAsset.deleteMany({ where: { event_id: { in: eventIds } } })
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } })
    if (buyer) {
      await prisma.userRole.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.user.deleteMany({ where: { id: buyer.userId } })
    }
    await app.close()
  })

  it('tells how a transfer order is paid and links to its event gallery, keeping every other field', async () => {
    const event = await createEvent(true)
    const orderId = await createPendingTransferOrder(event.id)

    const res = await get(`/orders/me/${orderId}`).expect(200)

    expect(res.body.data).toMatchObject({
      id: orderId,
      state: 'in_process',
      paymentMethod: 'transfer',
      eventSlug: event.slug,
    })
    expect(Object.keys(res.body.data).sort()).toEqual(
      [
        'id',
        'state',
        'eventName',
        'createdAt',
        'subtotal',
        'snapCurrency',
        'canDownload',
        'canCancel',
        'confirmingTransactionId',
        'billing',
        'photos',
        'invoice',
        'paymentMethod',
        'eventSlug',
      ].sort(),
    )

    const list = await get('/orders/me?limit=50').expect(200)
    const listed = list.body.data.find((item: { id: string }) => item.id === orderId)
    expect(listed).toMatchObject({ paymentMethod: 'transfer', eventSlug: event.slug })
  })

  it('gives no event slug when the event gallery would answer 404', async () => {
    const event = await createEvent(false)
    const orderId = await createPendingTransferOrder(event.id)

    const res = await get(`/orders/me/${orderId}`).expect(200)

    expect(res.body.data).toMatchObject({ paymentMethod: 'transfer', eventSlug: null })
  })
})
