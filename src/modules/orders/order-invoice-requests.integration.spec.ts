import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import { CancelOrderCommand } from '@orders/application/commands/cancel-order/cancel-order.command'
import { CancelOrderHandler } from '@orders/application/commands/cancel-order/cancel-order.handler'
import { ConfirmOrderPaymentCommand } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.command'
import { ConfirmOrderPaymentHandler } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.handler'
import { ConvertOrderToGiftCommand } from '@orders/application/commands/convert-order-to-gift/convert-order-to-gift.command'
import { ConvertOrderToGiftHandler } from '@orders/application/commands/convert-order-to-gift/convert-order-to-gift.handler'
import { ConvertOrderToSaleCommand } from '@orders/application/commands/convert-order-to-sale/convert-order-to-sale.command'
import { ConvertOrderToSaleHandler } from '@orders/application/commands/convert-order-to-sale/convert-order-to-sale.handler'
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

describe('invoice requests when an order becomes a sale', () => {
  let module: TestingModule
  let prisma: PrismaService
  let tenantId: string
  let userId: string
  let eventId: string
  let billingAccountId: string
  const orderIds: string[] = []
  let admin: AuditContext

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
        { provide: NotificationsService, useValue: { emitOrderPaid: () => undefined } },
        { provide: RIKUCHIY_OUTBOX_REPOSITORY, useClass: RikuchiyOutboxRepository },
        { provide: ORDER_TAX_DOCUMENT_REPOSITORY, useClass: OrderTaxDocumentRepository },
        OrderInvoiceStateRefresher,
        { provide: INVOICE_SOURCE_READER, useClass: InvoiceSourceReader },
        { provide: RIKUCHIY_INVOICE_REQUESTER, useClass: RikuchiyInvoiceRequesterService },
        ConfirmOrderPaymentHandler,
        CancelOrderHandler,
        ConvertOrderToGiftHandler,
        ConvertOrderToSaleHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    const tenant = await prisma.tenant.create({
      data: { name: 'Rikuchiy Invoices Tenant', is_platform: false, event_quota: 10 },
    })
    tenantId = tenant.id
    const user = await prisma.user.create({
      data: { email: `rikuchiy-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    userId = user.id
    admin = new AuditContext(user.id)
    const event = await prisma.event.create({
      data: {
        name: 'Downhill Teleférico',
        slug: `rikuchiy-invoices-${randomUUID()}`,
        start_date: new Date('2026-08-29'),
        end_date: new Date('2026-08-29'),
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
        legal_name: 'Juan Pérez',
        email: 'juan@correo.com',
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

  async function createOrder(options: { withBilling: boolean }): Promise<string> {
    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: userId,
        status: 'pending',
        payment_method: 'transfer',
        subtotal: '6.00',
        snap_email: 'juan@correo.com',
        ...(options.withBilling
          ? {
              snap_billing_account_id: billingAccountId,
              snap_billing_id_type: 'national_id' as const,
              snap_billing_id_number: '1710034065',
              snap_billing_legal_name: 'Juan Pérez',
              snap_billing_email: 'juan@correo.com',
              snap_invoice_consent_at: new Date('2026-11-03T15:00:00Z'),
              snap_invoice_consent_ip: '190.1.1.1',
            }
          : {}),
      },
    })
    orderIds.push(order.id)
    for (const name of ['DH-001.jpg', 'DH-002.jpg']) {
      const key = randomUUID()
      const photo = await prisma.photo.create({
        data: {
          event_id: eventId,
          filename: name,
          storage_key: `events/${eventId}/${key}.jpg`,
          public_slug: key.slice(0, 30),
          file_size: 1024,
        },
      })
      await prisma.orderItem.create({
        data: { order_id: order.id, photo_id: photo.id, unit_price: '3.00' },
      })
    }
    return order.id
  }

  const rowsOf = (orderId: string) =>
    prisma.rikuchiyOutboxItem.findMany({ where: { order_id: orderId } })

  const confirm = (orderId: string) =>
    module.get(ConfirmOrderPaymentHandler).execute(new ConfirmOrderPaymentCommand(orderId, admin))

  it('queues one emission with the frozen buyer when the payment is confirmed', async () => {
    const orderId = await createOrder({ withBilling: true })

    await confirm(orderId)

    const rows = await rowsOf(orderId)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
    expect(rows[0].kind).toBe('emit')
    const payload = rows[0].payload as Record<string, unknown>
    expect(payload).toMatchObject({
      emissionId: rows[0].emission_id,
      sale: { app: 'cycling-photo', externalRef: orderId },
      buyer: { idType: '05', idNumber: '1710034065', email: 'juan@correo.com' },
      total: '6.00',
      paymentMethod: '20',
    })
    expect((payload.lines as unknown[]).length).toBe(2)
  })

  it('never queues a second pending emission', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)

    const requester = module.get(RIKUCHIY_INVOICE_REQUESTER)
    await prisma.$transaction((tx) => requester.request(orderId, tx))

    expect(await rowsOf(orderId)).toHaveLength(1)
  })

  it('suppresses a pending emission when the paid order is cancelled', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)

    await module.get(CancelOrderHandler).execute(new CancelOrderCommand(orderId, admin.userId))

    const rows = await rowsOf(orderId)
    expect(rows.map((row) => row.status)).toEqual(['suppressed'])
  })

  const markEmissionsSent = (orderId: string) =>
    prisma.rikuchiyOutboxItem.updateMany({
      where: { order_id: orderId, kind: 'emit', status: 'pending' },
      data: { status: 'sent', sent_at: new Date() },
    })

  const cancel = (orderId: string) =>
    module.get(CancelOrderHandler).execute(new CancelOrderCommand(orderId, admin.userId))

  const annulmentsOf = async (orderId: string) =>
    (await rowsOf(orderId)).filter((row) => row.kind === 'annul')

  it('annuls an emission already sent when the order is cancelled', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)
    await markEmissionsSent(orderId)

    await cancel(orderId)

    const annulments = await annulmentsOf(orderId)
    expect(annulments).toHaveLength(1)
    expect(annulments[0].status).toBe('pending')
    expect(annulments[0].external_ref).toBe(orderId)
    expect(annulments[0].payload).toMatchObject({ reason: 'Pedido cancelado' })
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.invoice_state).toBe('in_process')
  })

  it('suppresses a pending correction and annuls the sent emission', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)
    await markEmissionsSent(orderId)
    const requester = module.get(RIKUCHIY_INVOICE_REQUESTER)
    await prisma.$transaction((tx) => requester.request(orderId, tx))
    expect((await rowsOf(orderId)).map((row) => row.status).sort()).toEqual(['pending', 'sent'])

    await cancel(orderId)

    const rows = await rowsOf(orderId)
    expect(rows.find((row) => row.kind === 'emit' && row.status !== 'sent')?.status).toBe(
      'suppressed',
    )
    expect(await annulmentsOf(orderId)).toHaveLength(1)
  })

  it('writes nothing when the only emission was rejected at intake', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)
    await prisma.rikuchiyOutboxItem.updateMany({
      where: { order_id: orderId },
      data: { status: 'rejected' },
    })

    await cancel(orderId)

    expect(await annulmentsOf(orderId)).toHaveLength(0)
  })

  it('annuls with the gift reason when the order becomes a gift', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)
    await markEmissionsSent(orderId)

    await module
      .get(ConvertOrderToGiftHandler)
      .execute(new ConvertOrderToGiftCommand(orderId, admin))

    const annulments = await annulmentsOf(orderId)
    expect(annulments).toHaveLength(1)
    expect(annulments[0].payload).toMatchObject({ reason: 'Pedido convertido en cortesía' })
  })

  it('sells again under a new reference after an annulment', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)
    await markEmissionsSent(orderId)
    await module
      .get(ConvertOrderToGiftHandler)
      .execute(new ConvertOrderToGiftCommand(orderId, admin))

    await module
      .get(ConvertOrderToSaleHandler)
      .execute(new ConvertOrderToSaleCommand(orderId, admin))

    const emissions = (await rowsOf(orderId)).filter(
      (row) => row.kind === 'emit' && row.status === 'pending',
    )
    expect(emissions).toHaveLength(1)
    expect(emissions[0].external_ref).toBe(`${orderId}-2`)
    expect(emissions[0].payload).toMatchObject({ sale: { externalRef: `${orderId}-2` } })
  })

  it('does not annul twice a sale already annulled when its re-sale is cancelled', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)
    await markEmissionsSent(orderId)
    const requester = module.get(RIKUCHIY_INVOICE_REQUESTER)
    await prisma.$transaction((tx) => requester.request(orderId, tx))
    await markEmissionsSent(orderId)
    await module
      .get(ConvertOrderToGiftHandler)
      .execute(new ConvertOrderToGiftCommand(orderId, admin))
    await module
      .get(ConvertOrderToSaleHandler)
      .execute(new ConvertOrderToSaleCommand(orderId, admin))

    await cancel(orderId)

    expect(await annulmentsOf(orderId)).toHaveLength(1)
  })

  it('sells again under the original reference when the only annulment was rejected', async () => {
    const orderId = await createOrder({ withBilling: true })
    await confirm(orderId)
    await markEmissionsSent(orderId)
    await module
      .get(ConvertOrderToGiftHandler)
      .execute(new ConvertOrderToGiftCommand(orderId, admin))
    await prisma.rikuchiyOutboxItem.updateMany({
      where: { order_id: orderId, kind: 'annul' },
      data: { status: 'rejected' },
    })

    await module
      .get(ConvertOrderToSaleHandler)
      .execute(new ConvertOrderToSaleCommand(orderId, admin))

    const pending = (await rowsOf(orderId)).filter(
      (row) => row.kind === 'emit' && row.status === 'pending',
    )
    expect(pending.map((row) => row.external_ref)).toEqual([orderId])
  })

  it('queues nothing for an order without billing data', async () => {
    const orderId = await createOrder({ withBilling: false })

    await confirm(orderId)

    expect(await rowsOf(orderId)).toHaveLength(0)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('paid')
  })
})
