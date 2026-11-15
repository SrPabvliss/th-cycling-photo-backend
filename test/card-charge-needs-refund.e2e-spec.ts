import { randomBytes } from 'node:crypto'
import type { OrderStatus, PrismaClient } from '@generated/prisma/client'
import { MailService } from '@mail/application/services/mail.service'
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
import { PAYMENT_GATEWAY_REGISTRY } from '../src/shared/payment-gateways'
import { createAuthenticatedUser, type TestAuthUser } from './fixtures/factories/auth.factory'
import { ensurePaymentSystemUser } from './fixtures/factories/payment-system-user.factory'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { getPlatformTenantId } from './fixtures/factories/tenant.factory'
import { createEventFixture } from './fixtures/factories/user.factory'

const AMOUNT_CENTS = 800

/** A gateway that approves every charge it is asked about, for the amount it was opened with. */
const approvingGateway = {
  provider: 'payphone',
  calls: 0,
  platformCredentials: () => ({ token: 'not-a-real-token', storeId: 'not-a-real-store' }),
  commissionCents: () => 0,
  buildCheckoutIntent: () => ({ provider: 'payphone', payload: {} }),
  verifyReceiver: async () => true,
  confirm: async () => {
    approvingGateway.calls += 1
    return {
      approved: true,
      gatewayTransactionId: `gw-${approvingGateway.calls}`,
      amountCents: AMOUNT_CENTS,
      authorizationCode: 'W4242',
      cardBrand: 'Visa',
      lastDigits: 'XX11',
      message: null,
      raw: {},
    }
  },
}

/**
 * The money moves at the gateway whatever state the order is in by then. A card charge approved
 * for an order that was already paid some other way, cancelled or gifted is a charge the buyer
 * must get back: it is never settled, it is logged as an error and staff are told to refund it.
 * Only the run that learns of the approval tells them, so asking about the same charge again
 * never repeats the alert.
 */
describe('A card charge approved for an order that can no longer take it (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let staff: TestAuthUser
  let systemUserId: string
  let eventId: string
  const orderIds: string[] = []
  const transactionIds: string[] = []

  const db = () => prisma as unknown as PrismaClient

  async function order(status: OrderStatus, confirmedById: string | null = null) {
    const photoId = await createPhotoFixture(db(), eventId)
    const created = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status,
        payment_method: 'card',
        subtotal: '8.00',
        snap_currency: 'USD',
        snap_first_name: 'Ana',
        snap_last_name: 'Rider',
        confirmed_by_id: confirmedById,
        paid_at: confirmedById ? new Date() : null,
        items: { create: [{ photo_id: photoId, unit_price: '8.00' }] },
      },
    })
    orderIds.push(created.id)
    return created.id
  }

  async function cardCharge(orderId: string, status: 'initiated' | 'approved' = 'initiated') {
    const clientTransactionId = `tt-${randomBytes(8).toString('hex')}`
    const transaction = await prisma.paymentTransaction.create({
      data: {
        client_transaction_id: clientTransactionId,
        provider: 'payphone',
        status,
        confirmed_at: status === 'approved' ? new Date() : null,
        amount_cents: AMOUNT_CENTS,
        amount_without_tax_cents: AMOUNT_CENTS,
        amount_with_tax_cents: 0,
        tax_cents: 0,
        commission_cents: 40,
        mode_snapshot: 'split_receiver',
        receiver_snapshot: '0991234567',
        store_id_snapshot: 'not-a-real-store',
        orders: { create: [{ order_id: orderId }] },
      },
    })
    transactionIds.push(transaction.id)
    return clientTransactionId
  }

  const confirm = (clientTransactionId: string) =>
    request(app.getHttpServer())
      .post('/api/v1/payments/confirm')
      .set({ Authorization: `Bearer ${buyer.token}` })
      .send({ clientTransactionId, id: 4242 })
      .expect(201)

  const refundAlertsFor = (orderId: string) =>
    prisma.notification.findMany({
      where: {
        user_id: staff.userId,
        type: 'payment.needs_refund',
        data: { path: ['orderId'], equals: orderId },
      },
    })

  /** Notifications are written after the request answers; wait until the expected count is in. */
  async function settledAlerts(orderId: string, expected: number) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const alerts = await refundAlertsFor(orderId)
      if (alerts.length >= expected) return alerts
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return refundAlertsFor(orderId)
  }

  const statusOf = async (clientTransactionId: string) =>
    (
      await prisma.paymentTransaction.findUniqueOrThrow({
        where: { client_transaction_id: clientTransactionId },
      })
    ).status

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENT_GATEWAY_REGISTRY)
      .useValue({ get: () => approvingGateway })
      .overrideProvider(MailService)
      .useValue({ enqueue: jest.fn() })
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
    await ensurePaymentSystemUser(db())
    const adminTemplate = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'platform_admin' },
    })
    const systemUser = await prisma.user.update({
      where: { email: process.env.PAYMENT_SYSTEM_USER_EMAIL as string },
      data: {
        permission_template_id: adminTemplate.id,
        tenant_id: await getPlatformTenantId(db()),
      },
    })
    systemUserId = systemUser.id

    await app.init()

    const jwt = moduleFixture.get(JwtService)
    buyer = await createAuthenticatedUser(db(), jwt, 'customer')
    staff = await createAuthenticatedUser(db(), jwt, 'admin')
    eventId = await createEventFixture(db())
  })

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { user_id: staff?.userId } })
    await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.deliveryLink.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.paymentTransactionOrder.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.paymentTransaction.deleteMany({ where: { id: { in: transactionIds } } })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
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

  describe('tells staff to refund it', () => {
    it.each([
      ['paid by transfer, confirmed by staff', 'paid', 'staff', 'order_paid'],
      ['delivered after staff confirmed the transfer', 'delivered', 'staff', 'order_paid'],
      ['cancelled', 'cancelled', null, 'order_cancelled'],
      ['gifted', 'gifted', null, 'order_gifted'],
    ] as const)('when the order was %s', async (_, status, confirmedBy, reason) => {
      const orderId = await order(status, confirmedBy === 'staff' ? staff.userId : null)
      const clientTransactionId = await cardCharge(orderId)

      const res = await confirm(clientTransactionId)

      expect(res.body.data).toMatchObject({ approved: true, settled: false, refund: { reason } })
      expect(await statusOf(clientTransactionId)).toBe('approved')
      expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
        status,
        confirmed_by_id: confirmedBy === 'staff' ? staff.userId : null,
      })
      const alerts = await settledAlerts(orderId, 1)
      expect(alerts).toHaveLength(1)
      expect(alerts[0].data).toMatchObject({
        orderId,
        clientTransactionId,
        amountCents: AMOUNT_CENTS,
        orderStatus: status,
        reason,
      })
    })

    it('when another card charge had already paid the order', async () => {
      const orderId = await order('paid', null)
      await prisma.order.update({ where: { id: orderId }, data: { confirmed_by_id: systemUserId } })
      await cardCharge(orderId, 'approved')
      const second = await cardCharge(orderId)

      const res = await confirm(second)

      expect(res.body.data.refund).toEqual({ reason: 'order_paid' })

      const alerts = await settledAlerts(orderId, 1)
      expect(alerts.map((alert) => alert.data)).toEqual([
        expect.objectContaining({ clientTransactionId: second, reason: 'order_paid' }),
      ])
    })

    it('once, however many times the same charge is confirmed again', async () => {
      const orderId = await order('cancelled')
      const clientTransactionId = await cardCharge(orderId)

      await confirm(clientTransactionId)
      await settledAlerts(orderId, 1)
      await confirm(clientTransactionId)
      const reload = await confirm(clientTransactionId)
      await new Promise((resolve) => setTimeout(resolve, 300))

      expect(await refundAlertsFor(orderId)).toHaveLength(1)
      // A reload of the return screen still tells the buyer the charge will be refunded.
      expect(reload.body.data.refund).toEqual({ reason: 'order_cancelled' })
    })
  })

  describe('stays quiet', () => {
    it('when the charge pays the order, and when that charge is confirmed again', async () => {
      const orderId = await order('draft')
      const clientTransactionId = await cardCharge(orderId)

      const first = await confirm(clientTransactionId)
      const again = await confirm(clientTransactionId)
      await new Promise((resolve) => setTimeout(resolve, 300))

      expect(first.body.data).toMatchObject({ approved: true, settled: true, refund: null })
      // The normal reload: already paid by this same charge, nothing to refund.
      expect(again.body.data).toMatchObject({ approved: true, settled: false, refund: null })
      expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).not.toBe(
        'draft',
      )
      expect(await refundAlertsFor(orderId)).toHaveLength(0)
    })
  })
})
