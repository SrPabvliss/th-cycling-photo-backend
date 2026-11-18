import type { OrderStatus, PrismaClient } from '@generated/prisma/client'
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
 * An order freezes the buyer's phone when it is placed, and that is the number the organizer writes
 * to. A buyer who mistyped it and fixed it in their account left the order with the wrong one, and
 * the only way out was editing production by hand. Now the order follows the account while it is in
 * progress, and staff can correct it from the order itself.
 */
describe('The contact phone of an order (e2e)', () => {
  const WRONG = '+593900000001'
  const RIGHT = '+593999888777'
  const OTHER = '+593999111222'

  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let staff: TestAuthUser
  let eventId: string

  const db = () => prisma as unknown as PrismaClient

  async function order(status: OrderStatus, delivered = false) {
    const photoId = await createPhotoFixture(db(), eventId)
    const created = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status,
        payment_method: 'transfer',
        subtotal: '8.00',
        snap_currency: 'USD',
        snap_first_name: 'Ana',
        snap_last_name: 'Rider',
        snap_phone: WRONG,
        delivered_at: delivered ? new Date() : null,
        items: { create: [{ photo_id: photoId, unit_price: '8.00' }] },
      },
    })
    return created.id
  }

  const phoneOf = async (orderId: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).snap_phone

  const primaryPhone = async () =>
    (await prisma.userPhone.findFirst({ where: { user_id: buyer.userId, is_primary: true } }))
      ?.phone_number ?? null

  const correct = (orderId: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/contact-phone`)
      .set({ Authorization: `Bearer ${staff.token}` })
      .send(body)

  async function resetBuyer() {
    const orders = await prisma.order.findMany({
      where: { user_id: buyer.userId },
      select: { id: true },
    })
    const orderIds = orders.map((each) => each.id)
    await prisma.orderContactChange.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    await prisma.userPhone.deleteMany({ where: { user_id: buyer.userId } })
    await prisma.userPhone.create({
      data: { user_id: buyer.userId, phone_number: WRONG, is_whatsapp: true, is_primary: true },
    })
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
    await ensurePaymentSystemUser(prisma as unknown as PrismaClient)
    await app.init()

    const jwt = moduleFixture.get(JwtService)
    buyer = await createAuthenticatedUser(db(), jwt, 'customer')
    staff = await createAuthenticatedUser(db(), jwt, 'admin')
    eventId = await createEventFixture(db())
  })

  beforeEach(resetBuyer)

  afterAll(async () => {
    await resetBuyer()
    await prisma.userPhone.deleteMany({ where: { user_id: buyer.userId } })
    if (eventId) {
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
    }
    for (const user of [buyer, staff].filter(Boolean)) {
      await prisma.userRole.deleteMany({ where: { user_id: user.userId } })
      await prisma.user.deleteMany({ where: { id: user.userId } })
    }
    await app.close()
  })

  describe('corrected by staff from the order', () => {
    it('changes the order, the other orders in progress and the account, and leaves finished ones', async () => {
      const edited = await order('payment_info_sent')
      const alsoInProgress = await order('paid')
      const giftToDeliver = await order('gifted')
      const delivered = await order('delivered', true)
      const cancelled = await order('cancelled')

      const response = await correct(edited, { phoneNumber: RIGHT }).expect(200)

      expect(response.body.data).toMatchObject({
        id: edited,
        phoneNumber: RIGHT,
        updatedOrders: 3,
        accountUpdated: true,
      })
      expect(await phoneOf(edited)).toBe(RIGHT)
      expect(await phoneOf(alsoInProgress)).toBe(RIGHT)
      expect(await phoneOf(giftToDeliver)).toBe(RIGHT)
      expect(await phoneOf(delivered)).toBe(WRONG)
      expect(await phoneOf(cancelled)).toBe(WRONG)
      expect(await primaryPhone()).toBe(RIGHT)
      // The mistyped number is replaced, not kept next to the right one.
      expect(await prisma.userPhone.count({ where: { user_id: buyer.userId } })).toBe(1)
    })

    it('writes down who changed each order, from which number to which', async () => {
      const edited = await order('pending')

      await correct(edited, { phoneNumber: RIGHT }).expect(200)

      const changes = await prisma.orderContactChange.findMany({ where: { order_id: edited } })
      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({
        old_phone: WRONG,
        new_phone: RIGHT,
        source: 'admin',
        changed_by_id: staff.userId,
      })
    })

    it('corrects a finished order when that is the one being edited', async () => {
      const delivered = await order('delivered', true)

      await correct(delivered, { phoneNumber: RIGHT }).expect(200)

      expect(await phoneOf(delivered)).toBe(RIGHT)
    })

    it('leaves the account alone when asked to', async () => {
      const edited = await order('pending')

      const response = await correct(edited, { phoneNumber: RIGHT, updateAccount: false }).expect(
        200,
      )

      expect(response.body.data.accountUpdated).toBe(false)
      expect(await phoneOf(edited)).toBe(RIGHT)
      expect(await primaryPhone()).toBe(WRONG)
    })

    it('promotes a number the account already had instead of duplicating it', async () => {
      await prisma.userPhone.create({
        data: { user_id: buyer.userId, phone_number: RIGHT, is_whatsapp: false, is_primary: false },
      })
      const edited = await order('pending')

      await correct(edited, { phoneNumber: RIGHT }).expect(200)

      expect(await primaryPhone()).toBe(RIGHT)
      expect(await prisma.userPhone.count({ where: { user_id: buyer.userId } })).toBe(2)
    })

    it('takes a number typed with spaces, and refuses one without country code', async () => {
      const edited = await order('pending')

      await correct(edited, { phoneNumber: '+593 999 888 777' }).expect(200)
      expect(await phoneOf(edited)).toBe(RIGHT)

      await correct(edited, { phoneNumber: '0999888777' }).expect(400)
      expect(await phoneOf(edited)).toBe(RIGHT)
    })

    it('is not for the buyer to use', async () => {
      const edited = await order('pending')

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${edited}/contact-phone`)
        .set({ Authorization: `Bearer ${buyer.token}` })
        .send({ phoneNumber: RIGHT })
        .expect(403)
      expect(await phoneOf(edited)).toBe(WRONG)
    })
  })

  describe('changed by the buyer in their account', () => {
    const asBuyer = () => ({ Authorization: `Bearer ${buyer.token}` })
    const primaryId = async () =>
      (
        await prisma.userPhone.findFirstOrThrow({
          where: { user_id: buyer.userId, is_primary: true },
        })
      ).id

    it('gives a corrected primary number to the orders in progress, not to finished ones', async () => {
      const inProgress = await order('payment_info_sent')
      const delivered = await order('delivered', true)

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/users/me/phones/${await primaryId()}`)
        .set(asBuyer())
        .send({ phoneNumber: RIGHT })
        .expect(200)

      expect(response.body.data.syncedOrders).toBe(1)
      expect(await phoneOf(inProgress)).toBe(RIGHT)
      expect(await phoneOf(delivered)).toBe(WRONG)
      const changes = await prisma.orderContactChange.findMany({ where: { order_id: inProgress } })
      expect(changes[0]).toMatchObject({ source: 'customer', changed_by_id: buyer.userId })
    })

    it('follows the number the buyer makes primary', async () => {
      const inProgress = await order('paid')
      const extra = await prisma.userPhone.create({
        data: { user_id: buyer.userId, phone_number: OTHER, is_whatsapp: true, is_primary: false },
      })
      // An extra number is only that: the orders keep the primary one.
      expect(await phoneOf(inProgress)).toBe(WRONG)

      await request(app.getHttpServer())
        .patch(`/api/v1/users/me/phones/${extra.id}/primary`)
        .set(asBuyer())
        .expect(200)

      expect(await phoneOf(inProgress)).toBe(OTHER)
    })
  })
})
