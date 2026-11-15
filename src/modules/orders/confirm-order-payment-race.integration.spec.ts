import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import {
  ConfirmOrderPaymentCommand,
  type WhenAlreadyPaid,
} from '@orders/application/commands/confirm-order-payment/confirm-order-payment.command'
import { ConfirmOrderPaymentHandler } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.handler'
import { ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import * as OrderMapper from '@orders/infrastructure/mappers/order.mapper'
import { OrderWriteRepository } from '@orders/infrastructure/repositories/order-write.repository'
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

/**
 * Two runs paying the same order at once, against a real Postgres: the browser coming back from
 * the gateway and the sweep, two tabs, or two clicks of staff. The order must be paid once, with
 * one invoice request and one "order paid" notification.
 */
describe('paying an order when two confirmations race', () => {
  let module: TestingModule
  let prisma: PrismaService
  let tenantId: string
  let userId: string
  let eventId: string
  let billingAccountId: string
  const orderIds: string[] = []
  let systemActor: AuditContext

  const emitOrderPaid = jest.fn()

  /**
   * Lets a test stop one run right after it read the order (before any lock), to replay the exact
   * interleaving in which the other run finishes first.
   */
  let pauseAfterRead: { orderId: string; reached: () => void; release: Promise<void> } | null = null

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
            findByIdInScope: async (id: string) => {
              const row = await prismaService.order.findUnique({ where: { id } })
              const pause = pauseAfterRead
              if (pause && pause.orderId === id) {
                pauseAfterRead = null
                pause.reached()
                await pause.release
              }
              return row ? OrderMapper.toEntity(row) : null
            },
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
        { provide: NotificationsService, useValue: { emitOrderPaid } },
        { provide: RIKUCHIY_OUTBOX_REPOSITORY, useClass: RikuchiyOutboxRepository },
        { provide: ORDER_TAX_DOCUMENT_REPOSITORY, useClass: OrderTaxDocumentRepository },
        OrderInvoiceStateRefresher,
        { provide: INVOICE_SOURCE_READER, useClass: InvoiceSourceReader },
        { provide: RIKUCHIY_INVOICE_REQUESTER, useClass: RikuchiyInvoiceRequesterService },
        ConfirmOrderPaymentHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    const tenant = await prisma.tenant.create({
      data: { name: 'Settle Once Tenant', is_platform: false, event_quota: 10 },
    })
    tenantId = tenant.id
    const user = await prisma.user.create({
      data: { email: `settle-once-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    userId = user.id
    systemActor = new AuditContext(user.id)
    const event = await prisma.event.create({
      data: {
        name: 'Vuelta al Cotopaxi',
        slug: `settle-once-${randomUUID()}`,
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
        user_id: userId,
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
      await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.billingAccount.deleteMany({ where: { user_id: userId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.user.deleteMany({ where: { id: userId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  beforeEach(() => {
    emitOrderPaid.mockClear()
    pauseAfterRead = null
  })

  async function createPendingOrder(): Promise<string> {
    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: userId,
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

  const pay = (orderId: string, whenAlreadyPaid: WhenAlreadyPaid = 'skip') =>
    module
      .get(ConfirmOrderPaymentHandler)
      .execute(new ConfirmOrderPaymentCommand(orderId, systemActor, whenAlreadyPaid))

  const emissionsOf = (orderId: string) =>
    prisma.rikuchiyOutboxItem.findMany({ where: { order_id: orderId, kind: 'emit' } })

  const notificationsFor = (orderId: string) =>
    emitOrderPaid.mock.calls.filter(([payload]) => payload.orderId === orderId).length

  /** Stops the next run that reads `orderId` right after the read, until `release()`. */
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

  it('requests one invoice even when the first one already left the outbox before the late run', async () => {
    const orderId = await createPendingOrder()

    const pause = pauseNextReadOf(orderId)
    const late = pay(orderId)
    await pause.reached

    await pay(orderId)
    // The invoice worker picks the first emission up and sends it.
    await prisma.rikuchiyOutboxItem.updateMany({
      where: { order_id: orderId, kind: 'emit', status: 'pending' },
      data: { status: 'sent', sent_at: new Date() },
    })

    pause.release()
    const lateResult = await late

    expect(await emissionsOf(orderId)).toHaveLength(1)
    expect(notificationsFor(orderId)).toBe(1)
    expect(lateResult).toEqual({ id: orderId, alreadyPaid: true })
  })

  it('pays the order once when two runs confirm it at the same time', async () => {
    const orderId = await createPendingOrder()

    const results = await Promise.all([pay(orderId), pay(orderId)])

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.status).toBe('paid')
    expect(await emissionsOf(orderId)).toHaveLength(1)
    expect(notificationsFor(orderId)).toBe(1)
    expect(results.filter((result) => result.alreadyPaid === true)).toHaveLength(1)
  })

  it('pays each order of a two-order payment once when two runs settle it at the same time', async () => {
    const orderIdsOfPayment = [await createPendingOrder(), await createPendingOrder()].sort()
    // What settleOrders does for one payment: every order at once, in id order.
    const settle = () => Promise.all(orderIdsOfPayment.map((orderId) => pay(orderId)))

    const [first, second] = await Promise.all([settle(), settle()])

    for (const [index, orderId] of orderIdsOfPayment.entries()) {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
      expect(order.status).toBe('paid')
      expect(await emissionsOf(orderId)).toHaveLength(1)
      expect(notificationsFor(orderId)).toBe(1)
      const skipped = [first[index], second[index]].filter((result) => result.alreadyPaid === true)
      expect(skipped).toHaveLength(1)
    }
  })

  it('answers the losing staff run with order.not_pending and changes nothing more', async () => {
    const orderId = await createPendingOrder()

    const results = await Promise.allSettled([pay(orderId, 'reject'), pay(orderId, 'reject')])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect((fulfilled[0] as PromiseFulfilledResult<unknown>).value).toEqual({ id: orderId })
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      messageKey: 'order.not_pending',
    })
    expect(await emissionsOf(orderId)).toHaveLength(1)
    expect(notificationsFor(orderId)).toBe(1)
  })
})
