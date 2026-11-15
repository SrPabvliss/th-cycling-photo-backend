import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import { CancelMyOrderCommand } from '@orders/application/commands/cancel-my-order/cancel-my-order.command'
import { CancelMyOrderHandler } from '@orders/application/commands/cancel-my-order/cancel-my-order.handler'
import { CancelOrderCommand } from '@orders/application/commands/cancel-order/cancel-order.command'
import { CancelOrderHandler } from '@orders/application/commands/cancel-order/cancel-order.handler'
import {
  ConfirmOrderPaymentCommand,
  type WhenAlreadyPaid,
} from '@orders/application/commands/confirm-order-payment/confirm-order-payment.command'
import { ConfirmOrderPaymentHandler } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.handler'
import { ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import * as OrderMapper from '@orders/infrastructure/mappers/order.mapper'
import { OrderWriteRepository } from '@orders/infrastructure/repositories/order-write.repository'
import { PaymentTransactionWriteRepository } from '@payments/infrastructure/repositories/payment-transaction-write.repository'
import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import {
  INVOICE_SOURCE_READER,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_INVOICE_REQUESTER,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '@shared/rikuchiy/domain/ports'
import { InvoiceSourceReader } from '@shared/rikuchiy/infrastructure/repositories/invoice-source.reader'
import { OrderTaxDocumentRepository } from '@shared/rikuchiy/infrastructure/repositories/order-tax-document.repository'
import { RikuchiyOutboxRepository } from '@shared/rikuchiy/infrastructure/repositories/rikuchiy-outbox.repository'
import { OrderInvoiceStateRefresher } from '@shared/rikuchiy/infrastructure/services/order-invoice-state-refresher.service'
import { RikuchiyInvoiceRequesterService } from '@shared/rikuchiy/infrastructure/services/rikuchiy-invoice-requester.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

const ROUNDS = 5

type Settled = PromiseSettledResult<unknown>
const fulfilled = (results: Settled[]) => results.filter((result) => result.status === 'fulfilled')
const rejectionKeys = (results: Settled[]) =>
  results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => (result.reason as { messageKey?: string }).messageKey ?? String(result.reason))

/**
 * Cancelling an order while it is being paid, against a real Postgres: the buyer cancelling while
 * staff confirm their transfer or while their card payment comes back from Payphone, and staff
 * cancelling while it is paid. Exactly one may win, and the order must end in a state that matches
 * it: never a cancellation saved over a payment, never an invoice left requested for a cancelled
 * order, never a charge approved on an order cancelled meanwhile.
 */
describe('cancelling an order while it is being paid', () => {
  let module: TestingModule
  let prisma: PrismaService
  let tenantId: string
  let buyerId: string
  let staffId: string
  let eventId: string
  let billingAccountId: string
  const orderIds: string[] = []
  const paymentIds: string[] = []

  /** Stops the next pre-lock read of `orderId`, to replay a run that read before the other ended. */
  let pauseAfterRead: { orderId: string; reached: () => void; release: Promise<void> } | null = null

  async function readPausing(prismaService: PrismaService, id: string) {
    const row = await prismaService.order.findUnique({ where: { id } })
    const pause = pauseAfterRead
    if (pause && pause.orderId === id) {
      pauseAfterRead = null
      pause.reached()
      await pause.release
    }
    return row ? OrderMapper.toEntity(row) : null
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
          validate,
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        PrismaService,
        { provide: ORDER_WRITE_REPOSITORY, useClass: OrderWriteRepository },
        {
          provide: ORDER_READ_REPOSITORY,
          inject: [PrismaService],
          useFactory: (prismaService: PrismaService) => ({
            findByIdInScope: (id: string) => readPausing(prismaService, id),
            findById: (id: string) => readPausing(prismaService, id),
            hasPaymentInFlight: async (orderId: string) =>
              (await prismaService.paymentTransactionOrder.count({
                where: {
                  order_id: orderId,
                  payment_transaction: { status: { in: ['initiated', 'confirming'] } },
                },
              })) > 0,
            getDetail: async () => null,
          }),
        },
        {
          provide: AUTHORIZATION_SERVICE,
          useValue: {
            resolveEventScope: async () => EventScope.unrestricted(),
            assert: async () => undefined,
            can: async () => true,
          },
        },
        { provide: NotificationsService, useValue: { emitOrderPaid: jest.fn() } },
        { provide: RIKUCHIY_OUTBOX_REPOSITORY, useClass: RikuchiyOutboxRepository },
        { provide: ORDER_TAX_DOCUMENT_REPOSITORY, useClass: OrderTaxDocumentRepository },
        OrderInvoiceStateRefresher,
        { provide: INVOICE_SOURCE_READER, useClass: InvoiceSourceReader },
        { provide: RIKUCHIY_INVOICE_REQUESTER, useClass: RikuchiyInvoiceRequesterService },
        PaymentTransactionWriteRepository,
        ConfirmOrderPaymentHandler,
        CancelMyOrderHandler,
        CancelOrderHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    const tenant = await prisma.tenant.create({
      data: { name: 'Cancel Race Tenant', is_platform: false, event_quota: 10 },
    })
    tenantId = tenant.id
    const buyer = await prisma.user.create({
      data: { email: `cancel-race-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    buyerId = buyer.id
    const staff = await prisma.user.create({
      data: { email: `cancel-race-staff-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    staffId = staff.id
    const event = await prisma.event.create({
      data: {
        name: 'Vuelta al Cotopaxi',
        slug: `cancel-race-${randomUUID()}`,
        start_date: new Date('2026-11-01'),
        end_date: new Date('2026-11-01'),
        event_type_id: (await prisma.eventType.findFirstOrThrow()).id,
        tenant_id: tenant.id,
        photo_quota: 100,
        photos_uploaded: 0,
      },
    })
    eventId = event.id
    const account = await prisma.billingAccount.create({
      data: {
        user_id: buyerId,
        id_type: 'national_id',
        id_number: '1710034065',
        legal_name: 'Ana Rider',
        email: 'ana@correo.com',
        is_default: true,
      },
    })
    billingAccountId = account.id
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.paymentTransactionOrder.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.paymentTransaction.deleteMany({ where: { id: { in: paymentIds } } })
      await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.billingAccount.deleteMany({ where: { user_id: buyerId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.user.deleteMany({ where: { id: { in: [buyerId, staffId] } } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  beforeEach(() => {
    pauseAfterRead = null
  })

  async function createPendingOrder(): Promise<string> {
    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyerId,
        status: 'pending',
        payment_method: 'card',
        subtotal: '8.00',
        snap_email: 'ana@correo.com',
        snap_billing_account_id: billingAccountId,
        snap_billing_id_type: 'national_id',
        snap_billing_id_number: '1710034065',
        snap_billing_legal_name: 'Ana Rider',
        snap_billing_email: 'ana@correo.com',
        snap_invoice_consent_at: new Date('2026-11-12T15:00:00Z'),
        snap_invoice_consent_ip: '190.1.1.1',
      },
    })
    orderIds.push(order.id)
    const key = randomUUID()
    const photo = await prisma.photo.create({
      data: {
        event_id: eventId,
        filename: 'CTX-001.jpg',
        storage_key: `events/${eventId}/${key}.jpg`,
        public_slug: key.slice(0, 30),
        file_size: 1024,
      },
    })
    await prisma.orderItem.create({
      data: { order_id: order.id, photo_id: photo.id, unit_price: '8.00' },
    })
    return order.id
  }

  /** The buyer's card payment for the order, as checkout leaves it and the gateway moves it. */
  async function createCardPayment(
    orderId: string,
    status: 'initiated' | 'confirming' | 'approved' | 'expired',
  ): Promise<string> {
    const clientTransactionId = `race-${randomUUID().slice(0, 30)}`
    const payment = await prisma.paymentTransaction.create({
      data: {
        client_transaction_id: clientTransactionId,
        provider: 'payphone',
        status,
        amount_cents: 800,
        amount_without_tax_cents: 800,
        amount_with_tax_cents: 0,
        tax_cents: 0,
        commission_cents: 0,
        mode_snapshot: 'own_merchant',
        receiver_snapshot: 'seller',
        orders: { create: { order_id: orderId } },
      },
    })
    paymentIds.push(payment.id)
    return clientTransactionId
  }

  const buyerCancels = (orderId: string) =>
    module.get(CancelMyOrderHandler).execute(new CancelMyOrderCommand(buyerId, orderId))

  const staffCancels = (orderId: string) =>
    module.get(CancelOrderHandler).execute(new CancelOrderCommand(orderId, staffId))

  /** `reject`: staff confirming a transfer. `skip`: what the Payphone confirmation settles with. */
  const pay = (orderId: string, whenAlreadyPaid: WhenAlreadyPaid) =>
    module
      .get(ConfirmOrderPaymentHandler)
      .execute(new ConfirmOrderPaymentCommand(orderId, new AuditContext(staffId), whenAlreadyPaid))

  const orderOf = (orderId: string) => prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  const emissionsOf = (orderId: string) =>
    prisma.rikuchiyOutboxItem.findMany({ where: { order_id: orderId, kind: 'emit' } })

  function pauseNextReadOf(orderId: string) {
    let reached!: () => void
    let release!: () => void
    const reachedPromise = new Promise<void>((resolve) => {
      reached = resolve
    })
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve
    })
    pauseAfterRead = { orderId, reached, release: releasePromise }
    return { reached: reachedPromise, release }
  }

  /** Whether `promise` is still running after `ms`. */
  async function stillRunningAfter(promise: Promise<unknown>, ms: number): Promise<boolean> {
    let done = false
    promise.then(
      () => {
        done = true
      },
      () => {
        done = true
      },
    )
    await new Promise((resolve) => setTimeout(resolve, ms))
    return !done
  }

  /** Ends with an emission requested for a paid order and none for a cancelled one. */
  async function expectInvoiceMatches(orderId: string) {
    const order = await orderOf(orderId)
    const pending = (await emissionsOf(orderId)).filter((item) => item.status === 'pending')
    expect(pending).toHaveLength(order.status === 'paid' ? 1 : 0)
  }

  describe('the buyer cancels while staff confirm their transfer', () => {
    it('does not save the cancellation over a payment that landed after the cancel read the order', async () => {
      const orderId = await createPendingOrder()

      const pause = pauseNextReadOf(orderId)
      const cancel = buyerCancels(orderId)
      const cancelSettled = cancel.then(
        () => undefined,
        () => undefined,
      )
      // A cancel that never reads the order before its lock simply runs to the end here.
      await Promise.race([pause.reached, cancelSettled])
      const payment = pay(orderId, 'reject')
      const paymentSettled = payment.then(
        () => undefined,
        () => undefined,
      )
      await Promise.race([paymentSettled, new Promise((resolve) => setTimeout(resolve, 300))])
      pause.release()

      const results = await Promise.allSettled([cancel, payment])
      const order = await orderOf(orderId)

      expect(fulfilled(results)).toHaveLength(1)
      expect(['paid', 'cancelled']).toContain(order.status)
      const expectedLoserKey =
        order.status === 'paid' ? 'order.not_cancellable_by_owner' : 'order.not_pending'
      expect(rejectionKeys(results)).toEqual([expectedLoserKey])
      await expectInvoiceMatches(orderId)
    })

    it('lets exactly one win when both run at the same time', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const orderId = await createPendingOrder()

        const results = await Promise.allSettled([buyerCancels(orderId), pay(orderId, 'reject')])
        const order = await orderOf(orderId)

        expect(fulfilled(results)).toHaveLength(1)
        if (order.status === 'paid') {
          expect(rejectionKeys(results)).toEqual(['order.not_cancellable_by_owner'])
          expect(order.paid_at).not.toBeNull()
        } else {
          expect(order.status).toBe('cancelled')
          expect(rejectionKeys(results)).toEqual(['order.not_pending'])
        }
        await expectInvoiceMatches(orderId)
      }
    })
  })

  describe('the buyer cancels while their card payment comes back from Payphone', () => {
    it('refuses to cancel once the gateway approved the charge, before the order is settled', async () => {
      const orderId = await createPendingOrder()
      await createCardPayment(orderId, 'approved')

      await expect(buyerCancels(orderId)).rejects.toMatchObject({
        messageKey: 'order.payment_in_progress',
      })
      await pay(orderId, 'skip')

      expect((await orderOf(orderId)).status).toBe('paid')
      await expectInvoiceMatches(orderId)
    })

    it('refuses at once while Payphone answers a confirmation, even one reviving an expired payment', async () => {
      const orderId = await createPendingOrder()
      // Expired: no longer in flight by its status, yet a late confirmation may still approve it.
      const clientTransactionId = await createCardPayment(orderId, 'expired')

      // What askGateway does: hold the payment's lock while Payphone answers, then record it.
      let gatewayCalled!: () => void
      let gatewayAnswers!: () => void
      const called = new Promise<void>((resolve) => {
        gatewayCalled = resolve
      })
      const answer = new Promise<void>((resolve) => {
        gatewayAnswers = resolve
      })
      const gatewayStep = module
        .get(PaymentTransactionWriteRepository)
        .runLocked(clientTransactionId, async (transaction) => {
          gatewayCalled()
          await answer
          transaction.markApproved({
            approved: true,
            gatewayTransactionId: 'gw-1',
            authorizationCode: 'AUTH',
            cardBrand: 'Visa',
            lastDigits: '4242',
            amountCents: 800,
            message: null,
            raw: {},
          } as never)
        })
      await called

      const cancel = buyerCancels(orderId)
      const cancelSettled = cancel.then(
        () => undefined,
        () => undefined,
      )
      // The buyer is answered without waiting for Payphone.
      expect(await stillRunningAfter(cancel, 1_000)).toBe(false)
      await cancelSettled
      await expect(cancel).rejects.toMatchObject({ messageKey: 'order.payment_in_progress' })

      gatewayAnswers()
      await gatewayStep
      await pay(orderId, 'skip')
      expect((await orderOf(orderId)).status).toBe('paid')
      await expectInvoiceMatches(orderId)
    })

    it('lets the approved payment win every time it races the cancel', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const orderId = await createPendingOrder()
        await createCardPayment(orderId, 'approved')

        const [cancel, payment] = await Promise.allSettled([
          buyerCancels(orderId),
          pay(orderId, 'skip'),
        ])

        expect(payment.status).toBe('fulfilled')
        expect(cancel.status).toBe('rejected')
        expect(['order.payment_in_progress', 'order.not_cancellable_by_owner']).toContain(
          rejectionKeys([cancel])[0],
        )
        expect((await orderOf(orderId)).status).toBe('paid')
        await expectInvoiceMatches(orderId)
      }
    })

    it('never marks paid an order the buyer cancelled before a late approval', async () => {
      const orderId = await createPendingOrder()
      await createCardPayment(orderId, 'expired')

      await buyerCancels(orderId)
      await expect(pay(orderId, 'skip')).rejects.toMatchObject({ messageKey: 'order.not_pending' })

      expect((await orderOf(orderId)).status).toBe('cancelled')
      await expectInvoiceMatches(orderId)
    })
  })

  describe('staff cancel while the order is being paid', () => {
    it('cancels the order as it is after a payment that landed meanwhile, keeping that payment', async () => {
      const orderId = await createPendingOrder()

      const pause = pauseNextReadOf(orderId)
      const cancel = staffCancels(orderId)
      await pause.reached
      await pay(orderId, 'reject')
      pause.release()
      await cancel

      const order = await orderOf(orderId)
      expect(order.status).toBe('cancelled')
      // The payment is not erased by a copy of the order read before it.
      expect(order.paid_at).not.toBeNull()
      expect(order.confirmed_by_id).toBe(staffId)
      await expectInvoiceMatches(orderId)
    })

    it('always ends cancelled with no invoice left requested, whichever runs first', async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const orderId = await createPendingOrder()

        const [cancel, payment] = await Promise.allSettled([
          staffCancels(orderId),
          pay(orderId, 'reject'),
        ])
        const order = await orderOf(orderId)

        expect(cancel.status).toBe('fulfilled')
        expect(order.status).toBe('cancelled')
        if (payment.status === 'fulfilled') {
          expect(order.paid_at).not.toBeNull()
        } else {
          expect(rejectionKeys([payment])).toEqual(['order.not_pending'])
        }
        await expectInvoiceMatches(orderId)
      }
    })

    it('refuses to cancel an unpaid order whose card charge the gateway already approved', async () => {
      const orderId = await createPendingOrder()
      await createCardPayment(orderId, 'approved')

      await expect(staffCancels(orderId)).rejects.toMatchObject({
        messageKey: 'order.buyer_payment_in_progress',
      })
      expect((await orderOf(orderId)).status).toBe('pending')
    })
  })
})
