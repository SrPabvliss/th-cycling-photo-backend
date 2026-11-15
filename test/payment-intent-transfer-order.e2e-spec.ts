import type { OrderStatus, PaymentMethod, PrismaClient } from '@generated/prisma/client'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'
import { PaymentConfirmationScheduler } from '@payments/application/services/payment-confirmation-scheduler.service'
import { PaymentReceiverResolver } from '@payments/application/services/payment-receiver-resolver.service'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'
import { PAYMENT_GATEWAY_REGISTRY } from '../src/shared/payment-gateways'
import { createAuthenticatedUser, type TestAuthUser } from './fixtures/factories/auth.factory'
import { ensurePaymentSystemUser } from './fixtures/factories/payment-system-user.factory'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createEventFixture } from './fixtures/factories/user.factory'

const gateway = {
  provider: 'payphone',
  platformCredentials: () => ({ token: 'not-a-real-token', storeId: 'not-a-real-store' }),
  commissionCents: () => 0,
  buildCheckoutIntent: () => ({ provider: 'payphone', payload: {} }),
  verifyReceiver: async () => true,
}

const splitReceiver = {
  provider: 'payphone',
  mode: 'split_receiver',
  receiverIdentifier: '0991234567',
  credentialsEncrypted: null,
  isUsable: true,
}

/**
 * A card payment can only be opened for an order the buyer is paying by card. An order placed by
 * transfer is waiting for staff to confirm a bank transfer: opening a card payment on it would let
 * the same order be charged both ways.
 */
describe('Opening a card payment on an order placed by transfer (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let eventId: string
  const orderIds: string[] = []

  const auth = () => ({ Authorization: `Bearer ${buyer.token}` })
  const db = () => prisma as unknown as PrismaClient

  async function order(status: OrderStatus, paymentMethod: PaymentMethod | null) {
    const photoId = await createPhotoFixture(db(), eventId)
    const created = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status,
        payment_method: paymentMethod,
        subtotal: '8.00',
        snap_currency: 'USD',
        items: { create: [{ photo_id: photoId, unit_price: '8.00' }] },
      },
    })
    orderIds.push(created.id)
    return created.id
  }

  const openCardPayment = (orderId: string) =>
    request(app.getHttpServer())
      .post('/api/v1/payments/intent')
      .set(auth())
      .send({ orderIds: [orderId] })

  const transactionsOf = (orderId: string) =>
    prisma.paymentTransactionOrder.count({ where: { order_id: orderId } })

  const choose = (orderId: string, method: 'card' | 'transfer') =>
    request(app.getHttpServer())
      .patch('/api/v1/orders/payment-method')
      .set(auth())
      .send({ orderIds: [orderId], method })

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENT_GATEWAY_REGISTRY)
      .useValue({ get: () => gateway })
      .overrideProvider(PaymentReceiverResolver)
      .useValue({ resolveForEvent: async () => splitReceiver, acceptsCard: async () => true })
      .overrideProvider(PaymentConfirmationScheduler)
      .useValue({ schedule: async () => undefined })
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
    prisma = moduleFixture.get(PrismaService)
    // Another suite may have truncated `users`; PaymentSystemActor refuses to boot without it.
    await ensurePaymentSystemUser(prisma as unknown as PrismaClient)
    await app.init()

    buyer = await createAuthenticatedUser(db(), moduleFixture.get(JwtService), 'customer')
    eventId = await createEventFixture(db())
  })

  afterAll(async () => {
    const links = await prisma.paymentTransactionOrder.findMany({
      where: { order_id: { in: orderIds } },
      select: { payment_transaction_id: true },
    })
    await prisma.paymentTransactionOrder.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.paymentTransaction.deleteMany({
      where: { id: { in: links.map((link) => link.payment_transaction_id) } },
    })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    if (eventId) {
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
    }
    if (buyer) {
      await prisma.userRole.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.user.deleteMany({ where: { id: buyer.userId } })
    }
    await app.close()
  })

  describe('the card payment', () => {
    it.each([
      ['pending', 'transfer'],
      ['payment_info_sent', 'transfer'],
      // Orders placed before the method was recorded were all transfers.
      ['pending', null],
    ] as const)('is refused for a %s order paid by %s, with payment.order_is_transfer', async (status, method) => {
      const orderId = await order(status, method)

      const res = await openCardPayment(orderId).expect(422)

      expect(res.body.error).toMatchObject({
        code: 'BUSINESS_RULE',
        messageKey: 'payment.order_is_transfer',
      })
      expect(await transactionsOf(orderId)).toBe(0)
    })

    it.each([
      ['draft', 'card'],
      ['pending', 'card'],
    ] as const)('opens for a %s order paid by %s', async (status, method) => {
      const orderId = await order(status, method)

      await openCardPayment(orderId).expect(201)

      expect(await transactionsOf(orderId)).toBe(1)
    })

    it('opens again with another card after the gateway declined the first one', async () => {
      const orderId = await order('draft', 'card')
      await openCardPayment(orderId).expect(201)
      await prisma.paymentTransaction.updateMany({
        where: { orders: { some: { order_id: orderId } } },
        data: { status: 'declined' },
      })

      await openCardPayment(orderId).expect(201)

      expect(await transactionsOf(orderId)).toBe(2)
      expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
        'draft',
      )
    })

    it.each([
      'paid',
      'cancelled',
    ] as const)('is still refused for a %s order with payment.order_not_payable', async (status) => {
      const orderId = await order(status, 'card')

      const res = await openCardPayment(orderId).expect(422)

      expect(res.body.error.messageKey).toBe('payment.order_not_payable')
    })
  })

  describe('switching the payment method', () => {
    it.each([
      'pending',
      'payment_info_sent',
    ] as const)('refuses to turn a %s transfer order into a card one, leaving it a transfer', async (status) => {
      const orderId = await order(status, 'transfer')

      const res = await choose(orderId, 'card').expect(422)

      expect(res.body.error.messageKey).toBe('payment.order_is_transfer')
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).payment_method,
      ).toBe('transfer')
    })

    it('still turns a card draft into a transfer order (TIT-108)', async () => {
      const orderId = await order('draft', 'card')

      await choose(orderId, 'transfer').expect(200)

      expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
        status: 'pending',
        payment_method: 'transfer',
      })
    })
  })
})
