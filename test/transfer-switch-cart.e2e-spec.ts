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

describe('Switching a card order to transfer empties it from the cart (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let billingAccountId: string
  let cardEventId: string
  let otherEventId: string
  let cardEventPhotoIds: string[]
  let otherEventPhotoId: string

  const auth = () => ({ Authorization: `Bearer ${buyer.token}` })
  const db = () => prisma as unknown as PrismaClient

  async function photosInCart(): Promise<string[]> {
    const res = await request(app.getHttpServer()).get('/api/v1/cart').set(auth()).expect(200)
    return res.body.data
      .flatMap((group: { photos: Array<{ id: string }> }) => group.photos.map((photo) => photo.id))
      .sort()
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

    // What checkout asks of a buyer before it places any order: a profile with a country, a
    // billing account to invoice and consent to electronic invoicing.
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

    // Card is only offered on an event that has a usable Payphone receiver.
    cardEventId = await createEventFixture(db())
    await prisma.eventPayoutMethod.create({
      data: {
        event_id: cardEventId,
        provider: 'payphone',
        mode: 'split_receiver',
        receiver_identifier: '0991234567',
      },
    })
    cardEventPhotoIds = [
      await createPhotoFixture(db(), cardEventId),
      await createPhotoFixture(db(), cardEventId),
    ].sort()

    otherEventId = await createEventFixture(db())
    otherEventPhotoId = await createPhotoFixture(db(), otherEventId)
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

    const eventIds = [cardEventId, otherEventId].filter(Boolean)
    await prisma.photo.deleteMany({ where: { event_id: { in: eventIds } } })
    await prisma.eventPayoutMethod.deleteMany({ where: { event_id: { in: eventIds } } })
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

  it('takes the order photos out of the cart, keeps the other event, and shows the order as placed', async () => {
    for (const photoId of [...cardEventPhotoIds, otherEventPhotoId]) {
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set(auth())
        .send({ photoId })
        .expect(201)
    }

    const checkout = await request(app.getHttpServer())
      .post('/api/v1/cart/checkout')
      .set(auth())
      .send({ items: [{ eventId: cardEventId }], method: 'card', billingAccountId })
      .expect(201)
    const orderId: string = checkout.body.data.orders[0].orderId

    // A card checkout leaves the cart as it is until the charge is approved.
    expect(await photosInCart()).toEqual([...cardEventPhotoIds, otherEventPhotoId].sort())

    await request(app.getHttpServer())
      .patch('/api/v1/orders/payment-method')
      .set(auth())
      .send({ orderIds: [orderId], method: 'transfer' })
      .expect(200)

    expect(await photosInCart()).toEqual([otherEventPhotoId])

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.status).toBe('pending')
    expect(order.payment_method).toBe('transfer')

    const myOrders = await request(app.getHttpServer())
      .get('/api/v1/orders/me?limit=50')
      .set(auth())
      .expect(200)
    expect(myOrders.body.data).toEqual([
      expect.objectContaining({ id: orderId, state: 'in_process', photoCount: 2 }),
    ])

    // Taken out in the database too, not only hidden from the response.
    const cart = await prisma.cart.findFirstOrThrow({
      where: { user_id: buyer.userId, status: 'active' },
      select: { id: true },
    })
    expect(
      await prisma.cartItem.count({
        where: { cart_id: cart.id, photo_id: { in: cardEventPhotoIds }, removed_at: null },
      }),
    ).toBe(0)
  })
})
