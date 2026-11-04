import { randomUUID } from 'node:crypto'
import { MailService } from '@mail/application/services/mail.service'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { OrderInvoiceSyncService } from '@orders/infrastructure/services/order-invoice-sync.service'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import {
  type CachedTaxDocument,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_CLIENT,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '@shared/rikuchiy/domain/ports'
import { OrderTaxDocumentRepository } from '@shared/rikuchiy/infrastructure/repositories/order-tax-document.repository'
import { RikuchiyOutboxRepository } from '@shared/rikuchiy/infrastructure/repositories/rikuchiy-outbox.repository'
import { OrderInvoiceStateRefresher } from '@shared/rikuchiy/infrastructure/services/order-invoice-state-refresher.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

describe('order invoice sync', () => {
  let module: TestingModule
  let prisma: PrismaService
  let tenantId: string
  let userId: string
  let eventId: string
  const orderIds: string[] = []
  const client = { getSaleDocuments: jest.fn(), isConfigured: () => true }
  const mailService = { enqueue: jest.fn() }

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
        { provide: RIKUCHIY_OUTBOX_REPOSITORY, useClass: RikuchiyOutboxRepository },
        { provide: ORDER_TAX_DOCUMENT_REPOSITORY, useClass: OrderTaxDocumentRepository },
        { provide: RIKUCHIY_CLIENT, useValue: client },
        { provide: MailService, useValue: mailService },
        OrderInvoiceStateRefresher,
        OrderInvoiceSyncService,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    const tenant = await prisma.tenant.create({
      data: { name: 'Invoice Sync Tenant', is_platform: false, event_quota: 10 },
    })
    tenantId = tenant.id
    const user = await prisma.user.create({
      data: {
        email: `sync-${randomUUID()}@test.local`,
        password_hash: 'x',
        first_name: 'Juan',
      },
    })
    userId = user.id
    const event = await prisma.event.create({
      data: {
        name: 'Invoice Sync Event',
        slug: `invoice-sync-${randomUUID()}`,
        start_date: new Date('2026-08-29'),
        end_date: new Date('2026-08-29'),
        event_type_id: (await prisma.eventType.findFirstOrThrow()).id,
        tenant_id: tenant.id,
        photo_quota: 100,
        photos_uploaded: 0,
      },
    })
    eventId = event.id
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.orderTaxDocument.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.user.deleteMany({ where: { id: userId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  beforeEach(() => {
    client.getSaleDocuments.mockReset()
    mailService.enqueue.mockReset()
  })

  async function createOrder(): Promise<string> {
    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: userId,
        status: 'paid',
        payment_method: 'transfer',
        subtotal: '3.00',
        snap_email: 'juan@correo.com',
        invoice_state: 'in_process',
      },
    })
    orderIds.push(order.id)
    return order.id
  }

  async function addRow(
    orderId: string,
    kind: 'emit' | 'annul',
    externalRef: string,
    createdAt: Date,
  ): Promise<void> {
    await prisma.rikuchiyOutboxItem.create({
      data: {
        order_id: orderId,
        kind,
        emission_id: randomUUID(),
        payload: {},
        status: 'sent',
        external_ref: externalRef,
        created_at: createdAt,
        sent_at: createdAt,
      },
    })
  }

  const document = (externalRef: string): CachedTaxDocument => ({
    id: randomUUID(),
    externalRef,
    type: 'invoice',
    state: 'authorized',
    number: '001-001-000000123',
    accessKey: '2610202601180272781600110010010000001231234567811',
    issueDate: '2026-10-26',
    authorizedAt: new Date('2026-10-26T13:41:22.000Z'),
    sriMessages: [],
    deliveries: [],
    syncedAt: null,
  })

  it('caches the documents and settles the order as authorized', async () => {
    const orderId = await createOrder()
    await addRow(orderId, 'emit', orderId, new Date('2026-11-03T10:00:00Z'))
    client.getSaleDocuments.mockResolvedValue([document(orderId)])

    const view = await module.get(OrderInvoiceSyncService).syncOrder(orderId)

    expect(view?.state).toBe('authorized')
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.invoice_state).toBe('authorized')
    expect(order.invoice_synced_at).not.toBeNull()
    expect(await prisma.orderTaxDocument.count({ where: { order_id: orderId } })).toBe(1)
  })

  it('keeps the previous copy when rikuchiy is down', async () => {
    const orderId = await createOrder()
    await addRow(orderId, 'emit', orderId, new Date('2026-11-03T10:00:00Z'))
    client.getSaleDocuments.mockResolvedValue(null)

    const view = await module.get(OrderInvoiceSyncService).syncOrder(orderId)

    expect(view).toBeNull()
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.invoice_state).toBe('in_process')
    expect(order.invoice_synced_at).toBeNull()
    expect(await prisma.orderTaxDocument.count({ where: { order_id: orderId } })).toBe(0)
  })

  it('reads every sale reference of a resold order', async () => {
    const orderId = await createOrder()
    await addRow(orderId, 'emit', orderId, new Date('2026-11-03T10:00:00Z'))
    await addRow(orderId, 'annul', orderId, new Date('2026-11-03T10:05:00Z'))
    await addRow(orderId, 'emit', `${orderId}-2`, new Date('2026-11-03T10:10:00Z'))
    client.getSaleDocuments.mockResolvedValue([])

    await module.get(OrderInvoiceSyncService).syncOrder(orderId)

    expect(client.getSaleDocuments).toHaveBeenCalledTimes(2)
    expect(client.getSaleDocuments).toHaveBeenCalledWith(orderId)
    expect(client.getSaleDocuments).toHaveBeenCalledWith(`${orderId}-2`)
  })

  const rejected = (
    externalRef: string,
    type: 'invoice' | 'credit_note' = 'invoice',
  ): CachedTaxDocument => ({
    ...document(externalRef),
    type,
    state: 'returned',
    authorizedAt: null,
    sriMessages: [
      { identifier: '39', message: 'RUC invalido', additionalInfo: null, type: 'ERROR' },
      { identifier: '45', message: 'Direccion faltante', additionalInfo: null, type: 'ERROR' },
    ],
  })

  it('emails the buyer account once per SRI rejection', async () => {
    const orderId = await createOrder()
    await addRow(orderId, 'emit', orderId, new Date('2026-11-03T10:00:00Z'))
    client.getSaleDocuments.mockResolvedValue([rejected(orderId)])
    const service = module.get(OrderInvoiceSyncService)

    await service.syncOrder(orderId)
    await service.syncOrder(orderId)

    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
    const payload = mailService.enqueue.mock.calls[0][0]
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(payload.to).toBe(user.email)
    expect(payload.subject).toBe('Necesitamos corregir los datos de tu factura')
    expect(payload.template).toBe('invoice-rejected')
    expect(payload.vars.firstName).toBe('Juan')
    expect(payload.vars.orderRef).toBe(orderId.slice(0, 8))
    expect(payload.vars.eventName).toBe('Invoice Sync Event')
    expect(payload.vars.reason).toBe('39: RUC invalido. 45: Direccion faltante')
    expect(payload.vars.correctUrl).toMatch(new RegExp(`/account/orders/${orderId}$`))
    expect(payload.vars.logoUrl).toMatch(/\/brand\/logo-email\.png$/)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.invoice_rejection_notified_at).not.toBeNull()
  })

  it('emails again when the correction is rejected too', async () => {
    const orderId = await createOrder()
    await addRow(orderId, 'emit', orderId, new Date('2026-11-03T10:00:00Z'))
    const service = module.get(OrderInvoiceSyncService)
    const returned = rejected(orderId)

    client.getSaleDocuments.mockResolvedValue([returned])
    await service.syncOrder(orderId)
    client.getSaleDocuments.mockResolvedValue([{ ...returned, state: 'submitted' }])
    await service.syncOrder(orderId)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.invoice_rejection_notified_at).toBeNull()
    client.getSaleDocuments.mockResolvedValue([returned])
    await service.syncOrder(orderId)

    expect(mailService.enqueue).toHaveBeenCalledTimes(2)
  })

  it('does not email intake or credit note rejections', async () => {
    const intakeOrderId = await createOrder()
    await prisma.rikuchiyOutboxItem.create({
      data: {
        order_id: intakeOrderId,
        kind: 'emit',
        emission_id: randomUUID(),
        payload: {},
        status: 'rejected',
        external_ref: intakeOrderId,
        rejection_reason: 'invalid payload',
        created_at: new Date('2026-11-03T10:00:00Z'),
      },
    })
    const creditOrderId = await createOrder()
    await addRow(creditOrderId, 'emit', creditOrderId, new Date('2026-11-03T10:00:00Z'))
    const service = module.get(OrderInvoiceSyncService)

    client.getSaleDocuments.mockResolvedValue([])
    await service.syncOrder(intakeOrderId)
    client.getSaleDocuments.mockResolvedValue([
      document(creditOrderId),
      rejected(creditOrderId, 'credit_note'),
    ])
    await service.syncOrder(creditOrderId)

    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('sends an empty first name when the buyer has none', async () => {
    const orderId = await createOrder()
    await addRow(orderId, 'emit', orderId, new Date('2026-11-03T10:00:00Z'))
    await prisma.user.update({ where: { id: userId }, data: { first_name: null } })
    client.getSaleDocuments.mockResolvedValue([rejected(orderId)])

    await module.get(OrderInvoiceSyncService).syncOrder(orderId)
    await prisma.user.update({ where: { id: userId }, data: { first_name: 'Juan' } })

    expect(mailService.enqueue.mock.calls[0][0].vars.firstName).toBe('')
  })
})
