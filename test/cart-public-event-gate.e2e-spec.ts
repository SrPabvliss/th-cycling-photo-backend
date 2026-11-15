import { randomBytes } from 'node:crypto'
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

type EventSetup = {
  status?: 'active' | 'completed' | 'archived'
  cover?: boolean
  deleted?: boolean
}

/**
 * The cart only sells photos of events on public sale, under the same rule as the public
 * listing. What is already ordered is never taken back, and preview links stay a private way in.
 */
describe('Buying only from events on public sale (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let staff: TestAuthUser
  let billingAccountId: string
  const eventIds: string[] = []
  const previewLinkIds: string[] = []

  const db = () => prisma as unknown as PrismaClient
  const http = () => request(app.getHttpServer())
  const asBuyer = () => ({ Authorization: `Bearer ${buyer.token}` })
  const asStaff = () => ({ Authorization: `Bearer ${staff.token}` })

  async function event(setup: EventSetup = {}): Promise<string> {
    const id = await createEventFixture(db())
    eventIds.push(id)
    await prisma.event.update({
      where: { id },
      data: { status: setup.status ?? 'active', deleted_at: setup.deleted ? new Date() : null },
    })
    if (setup.cover !== false) {
      await prisma.eventAsset.create({
        data: {
          event_id: id,
          asset_type: 'cover_image',
          storage_key: `cover/${id}`,
          public_slug: `c${randomBytes(10).toString('hex')}`,
        },
      })
    }
    return id
  }

  const addToCart = (photoId: string) =>
    http().post('/api/v1/cart/items').set(asBuyer()).send({ photoId })

  const checkout = (eventId: string) =>
    http()
      .post('/api/v1/cart/checkout')
      .set(asBuyer())
      .send({ items: [{ eventId }], method: 'transfer', billingAccountId })

  async function photoIdsInCart(): Promise<string[]> {
    const res = await http().get('/api/v1/cart').set(asBuyer()).expect(200)
    return res.body.data.flatMap((group: { photos: Array<{ id: string }> }) =>
      group.photos.map((photo) => photo.id),
    )
  }

  async function emptyCart() {
    const carts = await prisma.cart.findMany({ where: { user_id: buyer.userId } })
    await prisma.cartItem.deleteMany({ where: { cart_id: { in: carts.map((cart) => cart.id) } } })
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

    const jwt = moduleFixture.get(JwtService)
    buyer = await createAuthenticatedUser(db(), jwt, 'customer')
    staff = await createAuthenticatedUser(db(), jwt, 'admin')

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
  })

  afterEach(async () => {
    if (buyer) await emptyCart()
  })

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { user_id: buyer?.userId },
      select: { id: true },
    })
    const orderIds = orders.map((order) => order.id)
    await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.paymentTransactionOrder.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })

    const carts = await prisma.cart.findMany({ where: { user_id: buyer?.userId } })
    await prisma.cartItem.deleteMany({ where: { cart_id: { in: carts.map((cart) => cart.id) } } })
    await prisma.cart.deleteMany({ where: { id: { in: carts.map((cart) => cart.id) } } })

    await prisma.previewLinkPhoto.deleteMany({ where: { preview_link_id: { in: previewLinkIds } } })
    await prisma.previewLink.deleteMany({ where: { id: { in: previewLinkIds } } })
    await prisma.photo.deleteMany({ where: { event_id: { in: eventIds } } })
    await prisma.eventAsset.deleteMany({ where: { event_id: { in: eventIds } } })
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } })

    for (const user of [buyer, staff].filter(Boolean)) {
      await prisma.billingAccount.deleteMany({ where: { user_id: user.userId } })
      await prisma.customerProfile.deleteMany({ where: { user_id: user.userId } })
      await prisma.userConsent.deleteMany({ where: { user_id: user.userId } })
      await prisma.userRole.deleteMany({ where: { user_id: user.userId } })
      await prisma.user.deleteMany({ where: { id: user.userId } })
    }
    await app.close()
  })

  describe('adding to the cart', () => {
    it.each([
      ['an active event with a cover', { status: 'active' }],
      ['a completed event with a cover', { status: 'completed' }],
    ] as const)('accepts a photo of %s', async (_, setup) => {
      const photoId = await createPhotoFixture(db(), await event(setup))

      await addToCart(photoId).expect(201)

      expect(await photoIdsInCart()).toEqual([photoId])
    })

    it.each([
      ['an archived event', { status: 'archived' }],
      ['a deleted event', { deleted: true }],
      ['an event without a cover', { cover: false }],
    ] as const)('refuses a photo of %s with cart.event_not_available', async (_, setup) => {
      const eventId = await event(setup)
      const photoId = await createPhotoFixture(db(), eventId)

      const res = await addToCart(photoId).expect(422)

      expect(res.body.error).toMatchObject({
        code: 'BUSINESS_RULE',
        messageKey: 'cart.event_not_available',
      })
      expect(await photoIdsInCart()).toEqual([])
    })
  })

  describe('checking out', () => {
    it('refuses an event taken off sale after its photos were added, placing no order', async () => {
      const eventId = await event()
      const photoId = await createPhotoFixture(db(), eventId)
      await addToCart(photoId).expect(201)
      await prisma.event.update({ where: { id: eventId }, data: { status: 'archived' } })

      const res = await checkout(eventId).expect(422)

      expect(res.body.error).toMatchObject({
        code: 'BUSINESS_RULE',
        messageKey: 'cart.event_not_available',
      })
      expect(await prisma.order.count({ where: { event_id: eventId } })).toBe(0)
      // The photo stays in the cart, so the buyer sees what to remove.
      expect(await photoIdsInCart()).toEqual([photoId])
    })
  })

  describe('an order placed before the event left public sale', () => {
    it('is still paid, shown and downloadable as before', async () => {
      const eventId = await event()
      const photoId = await createPhotoFixture(db(), eventId)
      await addToCart(photoId).expect(201)
      const placed = await checkout(eventId).expect(201)
      const orderId: string = placed.body.data.orders[0].orderId

      await prisma.event.update({ where: { id: eventId }, data: { status: 'archived' } })

      await http().patch(`/api/v1/orders/${orderId}/confirm-payment`).set(asStaff()).expect(200)
      expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('paid')

      const detail = await http().get(`/api/v1/orders/me/${orderId}`).set(asBuyer()).expect(200)
      expect(detail.body.data).toMatchObject({ id: orderId, state: 'ready', eventSlug: null })
      await http().get(`/api/v1/orders/me/${orderId}/downloads`).set(asBuyer()).expect(200)
    })
  })

  describe('preview links', () => {
    it('still sell the photos they hold, even of an event that is not on public sale', async () => {
      const eventId = await event({ cover: false })
      const photoId = await createPhotoFixture(db(), eventId)
      const link = await prisma.previewLink.create({
        data: {
          token: randomBytes(32).toString('hex'),
          event_id: eventId,
          expires_at: new Date(Date.now() + 86_400_000),
          created_by_id: staff.userId,
          photos: { create: [{ photo_id: photoId }] },
        },
      })
      previewLinkIds.push(link.id)

      const res = await http()
        .post(`/api/v1/preview/${link.token}/orders`)
        .set(asBuyer())
        .send({ photoIds: [photoId], method: 'transfer', billingAccountId })
        .expect(201)

      const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.data.id } })
      expect(order).toMatchObject({
        event_id: eventId,
        preview_link_id: link.id,
        status: 'pending',
      })
    })
  })
})
