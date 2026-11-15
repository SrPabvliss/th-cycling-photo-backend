import { CONSENT_TYPE, POLICY_VERSIONS } from '@auth/domain/constants/consent.constants'
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
import { ensurePaymentSystemUser } from './fixtures/factories/payment-system-user.factory'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createEventFixture } from './fixtures/factories/user.factory'

/**
 * A completed event keeps its public gallery: buyers find it, open it, buy from it and are sent
 * back to it from their orders, exactly as with an active one. An archived one stays hidden.
 */
describe('A completed event stays visible and purchasable (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let billingAccountId: string
  const eventIds: string[] = []
  let completed: { id: string; slug: string; name: string }
  let archived: { id: string; slug: string }
  let photoIds: string[]

  const auth = () => ({ Authorization: `Bearer ${buyer.token}` })
  const db = () => prisma as unknown as PrismaClient
  const http = () => request(app.getHttpServer())

  async function eventWithCover(status: 'completed' | 'archived') {
    const id = await createEventFixture(db())
    eventIds.push(id)
    const event = await prisma.event.update({
      where: { id },
      data: { status },
      select: { id: true, slug: true, name: true },
    })
    await prisma.eventAsset.create({
      data: {
        event_id: id,
        asset_type: 'cover_image',
        storage_key: `cover/${event.slug}`,
        public_slug: `c${event.slug}`.slice(0, 30),
      },
    })
    return event
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
    await ensurePaymentSystemUser(db())
    await app.init()

    buyer = await createAuthenticatedUser(db(), moduleFixture.get(JwtService), 'customer')

    // What checkout asks of a buyer before it places any order.
    const ecuador = await prisma.country.findFirstOrThrow({ where: { iso_code: 'EC' } })
    await prisma.customerProfile.create({ data: { user_id: buyer.userId, country_id: ecuador.id } })
    const billingAccount = await prisma.billingAccount.create({
      data: {
        user_id: buyer.userId,
        id_type: 'national_id',
        id_number: '1710034065',
        legal_name: 'E2E Customer',
        email: 'e2e-billing@test.local',
        is_default: true,
      },
    })
    billingAccountId = billingAccount.id
    await prisma.userConsent.create({
      data: {
        user_id: buyer.userId,
        type: CONSENT_TYPE.ELECTRONIC_INVOICE,
        policy_version: POLICY_VERSIONS[CONSENT_TYPE.ELECTRONIC_INVOICE],
      },
    })

    completed = await eventWithCover('completed')
    photoIds = [
      await createPhotoFixture(db(), completed.id),
      await createPhotoFixture(db(), completed.id),
    ].sort()
    archived = await eventWithCover('archived')
    await createPhotoFixture(db(), archived.id)
  })

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { user_id: buyer?.userId },
      select: { id: true },
    })
    const orderIds = orders.map((order) => order.id)
    await prisma.paymentTransactionOrder.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })

    const carts = await prisma.cart.findMany({
      where: { user_id: buyer?.userId },
      select: { id: true },
    })
    const cartIds = carts.map((cart) => cart.id)
    await prisma.cartItem.deleteMany({ where: { cart_id: { in: cartIds } } })
    await prisma.cart.deleteMany({ where: { id: { in: cartIds } } })

    await prisma.photo.deleteMany({ where: { event_id: { in: eventIds } } })
    await prisma.eventAsset.deleteMany({ where: { event_id: { in: eventIds } } })
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } })

    if (buyer) {
      await prisma.billingAccount.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.customerProfile.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.userConsent.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.userRole.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.user.deleteMany({ where: { id: buyer.userId } })
    }
    await app.close()
  })

  it('lists, opens and serves the photos of a completed event', async () => {
    const list = await http()
      .get('/api/v1/public/events')
      .query({ search: completed.name, limit: 50 })
      .expect(200)
    expect(list.body.data.map((event: { slug: string }) => event.slug)).toEqual([completed.slug])

    const detail = await http().get(`/api/v1/public/events/${completed.slug}`).expect(200)
    expect(detail.body.data.slug).toBe(completed.slug)

    const photos = await http().get(`/api/v1/public/events/${completed.slug}/photos`).expect(200)
    expect(photos.body.data).toHaveLength(2)
  })

  it('keeps an archived event hidden from the list, the detail and the photos', async () => {
    const list = await http()
      .get('/api/v1/public/events')
      .query({ search: archived.slug.replace('test-event-', ''), limit: 50 })
      .expect(200)
    expect(list.body.data).toEqual([])

    await http().get(`/api/v1/public/events/${archived.slug}`).expect(404)
    await http().get(`/api/v1/public/events/${archived.slug}/photos`).expect(404)
  })

  it('lets a buyer put its photos in the cart, place the order and come back to the gallery', async () => {
    for (const photoId of photoIds) {
      await http().post('/api/v1/cart/items').set(auth()).send({ photoId }).expect(201)
    }

    const checkout = await http()
      .post('/api/v1/cart/checkout')
      .set(auth())
      .send({ items: [{ eventId: completed.id }], method: 'transfer', billingAccountId })
      .expect(201)
    const orderId: string = checkout.body.data.orders[0].orderId

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { select: { photo_id: true } } },
    })
    expect(order).toMatchObject({ event_id: completed.id, status: 'pending' })
    expect(order.items.map((item) => item.photo_id).sort()).toEqual(photoIds)

    const myDetail = await http().get(`/api/v1/orders/me/${orderId}`).set(auth()).expect(200)
    expect(myDetail.body.data.eventSlug).toBe(completed.slug)

    const myList = await http().get('/api/v1/orders/me?limit=50').set(auth()).expect(200)
    expect(myList.body.data).toEqual([
      expect.objectContaining({ id: orderId, eventSlug: completed.slug }),
    ])
  })
})
