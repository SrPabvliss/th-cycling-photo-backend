import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@generated/prisma/client'
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

interface GatewayAnswer {
  approved: boolean
  gatewayTransactionId: string
  amountCents: number
  authorizationCode: string | null
  cardBrand: string | null
  lastDigits: string | null
  message: string | null
  raw: Record<string, unknown>
}

const AMOUNT_CENTS = 800

const APPROVED: GatewayAnswer = {
  approved: true,
  gatewayTransactionId: '4242',
  amountCents: AMOUNT_CENTS,
  authorizationCode: 'W4242',
  cardBrand: 'Visa',
  lastDigits: 'XX11',
  message: null,
  raw: {},
}

/**
 * There is no real gateway in the suite. The stand-in below answers when the test tells it to,
 * which is what lets a request be observed while its confirmation is still in flight.
 */
class ControllableGateway {
  readonly provider = 'payphone'
  calls = 0
  private pending: {
    resolve: (answer: GatewayAnswer) => void
    reject: (error: Error) => void
  } | null = null
  private entered: (() => void) | null = null

  platformCredentials = () => ({ token: 'not-a-real-token', storeId: 'not-a-real-store' })
  commissionCents = () => 0
  buildCheckoutIntent = () => ({ provider: 'payphone', payload: {} })
  verifyReceiver = async () => true

  confirm = (): Promise<GatewayAnswer> => {
    this.calls += 1
    return new Promise<GatewayAnswer>((resolve, reject) => {
      this.pending = { resolve, reject }
      this.entered?.()
    })
  }

  /** Resolves once a confirmation is waiting on the gateway. */
  whenAsked(): Promise<void> {
    if (this.pending) return Promise.resolve()
    return new Promise<void>((resolve) => {
      this.entered = resolve
    })
  }

  answer(answer: GatewayAnswer): void {
    this.pending?.resolve(answer)
    this.pending = null
    this.entered = null
  }

  fail(error: Error): void {
    this.pending?.reject(error)
    this.pending = null
    this.entered = null
  }
}

describe('Card order awaiting confirmation in my orders (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let eventId: string
  const gateway = new ControllableGateway()
  const createdOrderIds: string[] = []
  const createdPhotoIds: string[] = []
  const createdTransactionIds: string[] = []

  const auth = () => ({ Authorization: `Bearer ${buyer.token}` })

  async function createDraftCardOrder() {
    const photoId = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    createdPhotoIds.push(photoId)

    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status: 'draft',
        payment_method: 'card',
        subtotal: '8.00',
        snap_currency: 'USD',
        snap_first_name: 'Ana',
        snap_last_name: 'Rider',
        items: { create: [{ photo_id: photoId, unit_price: '8.00' }] },
      },
    })
    createdOrderIds.push(order.id)

    const clientTransactionId = `tt-${randomBytes(8).toString('hex')}`
    const transaction = await prisma.paymentTransaction.create({
      data: {
        client_transaction_id: clientTransactionId,
        provider: 'payphone',
        status: 'initiated',
        amount_cents: AMOUNT_CENTS,
        amount_without_tax_cents: AMOUNT_CENTS,
        amount_with_tax_cents: 0,
        tax_cents: 0,
        commission_cents: 40,
        mode_snapshot: 'split_receiver',
        receiver_snapshot: '0991234567',
        store_id_snapshot: 'not-a-real-store',
        orders: { create: [{ order_id: order.id }] },
      },
    })
    createdTransactionIds.push(transaction.id)

    return { orderId: order.id, clientTransactionId }
  }

  /**
   * Starts POST /payments/confirm and returns once the gateway is being asked. The response is
   * wrapped: an async function returning the promise itself would wait for the confirmation.
   */
  async function startConfirmation(clientTransactionId: string) {
    const response = request(app.getHttpServer())
      .post('/api/v1/payments/confirm')
      .set(auth())
      .send({ clientTransactionId, id: 4242 })
      .then((res) => res)
    await gateway.whenAsked()
    return { response }
  }

  async function myOrders(): Promise<Array<{ id: string; state: string }>> {
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders/me?limit=50')
      .set(auth())
      .expect(200)
    return res.body.data
  }

  const stateOf = async (orderId: string) =>
    (await myOrders()).find((order) => order.id === orderId)?.state

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENT_GATEWAY_REGISTRY)
      .useValue({ get: () => gateway })
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
    await ensurePaymentSystemUser(prisma as unknown as PrismaClient)
    // Settling an order is done as the payment system account, which in a real deployment is a
    // platform admin. Without the template it resolves to no permissions and nothing settles.
    const adminTemplate = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'platform_admin' },
    })
    await prisma.user.update({
      where: { email: process.env.PAYMENT_SYSTEM_USER_EMAIL as string },
      data: {
        permission_template_id: adminTemplate.id,
        tenant_id: await getPlatformTenantId(prisma as unknown as PrismaClient),
      },
    })

    await app.init()

    buyer = await createAuthenticatedUser(
      prisma as never,
      moduleFixture.get(JwtService),
      'customer',
    )
    eventId = await createEventFixture(prisma as unknown as PrismaClient)
  })

  afterAll(async () => {
    await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: createdOrderIds } } })
    await prisma.deliveryLink.deleteMany({ where: { order_id: { in: createdOrderIds } } })
    await prisma.paymentTransactionOrder.deleteMany({
      where: { order_id: { in: createdOrderIds } },
    })
    await prisma.paymentTransaction.deleteMany({ where: { id: { in: createdTransactionIds } } })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: createdOrderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
    await prisma.photo.deleteMany({ where: { id: { in: createdPhotoIds } } })
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } })
    if (buyer) {
      await prisma.userRole.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.user.deleteMany({ where: { id: buyer.userId } })
    }
    await app.close()
  })

  it('shows the order as confirming while the gateway is asked, and as ready once it settles', async () => {
    const { orderId, clientTransactionId } = await createDraftCardOrder()

    // Before the buyer comes back from the gateway it is an abandoned checkout: hidden.
    expect(await stateOf(orderId)).toBeUndefined()
    await request(app.getHttpServer()).get(`/api/v1/orders/me/${orderId}`).set(auth()).expect(404)

    const confirmation = await startConfirmation(clientTransactionId)

    expect(await stateOf(orderId)).toBe('confirming')

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${orderId}`)
      .set(auth())
      .expect(200)
    expect(detail.body.data).toMatchObject({
      id: orderId,
      state: 'confirming',
      canCancel: false,
      canDownload: false,
      invoice: null,
      confirmingTransactionId: clientTransactionId,
    })

    const transaction = await request(app.getHttpServer())
      .get(`/api/v1/payments/transactions/${clientTransactionId}`)
      .set(auth())
      .expect(200)
    expect(transaction.body.data.status).toBe('confirming')

    // Nothing the buyer could do to a real order works on one still being confirmed.
    await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${orderId}/downloads`)
      .set(auth())
      .expect(422)
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/me/${orderId}/cancel`)
      .set(auth())
      .expect(422)
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/me/${orderId}/billing`)
      .set(auth())
      .send({
        idType: 'national_id',
        idNumber: '1710034065',
        legalName: 'Ana Rider',
        email: 'ana@correo.com',
      })
      .expect(404)

    const summary = await request(app.getHttpServer())
      .get('/api/v1/orders/me/summary')
      .set(auth())
      .expect(200)
    expect(summary.body.data.orderCount).toBe(0)

    gateway.answer(APPROVED)
    const confirmed = await confirmation.response

    expect(confirmed.status).toBe(201)
    expect(confirmed.body.data).toMatchObject({
      approved: true,
      settled: true,
      orderIds: [orderId],
    })
    expect(gateway.calls).toBe(1)

    expect(await stateOf(orderId)).toBe('ready')
    const settled = await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${orderId}`)
      .set(auth())
      .expect(200)
    expect(settled.body.data).toMatchObject({
      state: 'ready',
      canDownload: true,
      confirmingTransactionId: null,
    })
  })

  it('keeps the order confirming when the gateway fails, and hides it again once declined', async () => {
    const { orderId, clientTransactionId } = await createDraftCardOrder()
    const callsBefore = gateway.calls

    const failing = await startConfirmation(clientTransactionId)
    gateway.fail(new Error('gateway unreachable'))
    const failed = await failing.response

    expect(failed.status).toBeGreaterThanOrEqual(500)
    expect(await stateOf(orderId)).toBe('confirming')
    const stored = await prisma.paymentTransaction.findUniqueOrThrow({
      where: { client_transaction_id: clientTransactionId },
    })
    expect(stored.status).toBe('confirming')

    const retry = await startConfirmation(clientTransactionId)
    gateway.answer({ ...APPROVED, approved: false, message: 'Fondos Insuficientes' })
    const declined = await retry.response

    expect(declined.status).toBe(201)
    expect(declined.body.data).toMatchObject({
      approved: false,
      settled: false,
      message: 'Fondos Insuficientes',
    })
    expect(gateway.calls).toBe(callsBefore + 2)

    expect(await stateOf(orderId)).toBeUndefined()
    await request(app.getHttpServer()).get(`/api/v1/orders/me/${orderId}`).set(auth()).expect(404)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.status).toBe('draft')
  })
})
