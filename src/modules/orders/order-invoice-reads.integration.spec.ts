import { randomUUID } from 'node:crypto'
import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  type IEventPayoutMethodRepository,
} from '@events/domain/ports'
import { MailService } from '@mail/application/services/mail.service'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { GetMyOrderDetailHandler } from '@orders/application/queries/get-my-order-detail/get-my-order-detail.handler'
import { GetMyOrderDetailQuery } from '@orders/application/queries/get-my-order-detail/get-my-order-detail.query'
import { GetOrderDetailHandler } from '@orders/application/queries/get-order-detail/get-order-detail.handler'
import { GetOrderDetailQuery } from '@orders/application/queries/get-order-detail/get-order-detail.query'
import { GetOrderTaxDocumentFilesHandler } from '@orders/application/queries/get-order-tax-document-files/get-order-tax-document-files.handler'
import { GetOrderTaxDocumentFilesQuery } from '@orders/application/queries/get-order-tax-document-files/get-order-tax-document-files.query'
import { ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { OrderInvoiceSyncService } from '@orders/infrastructure/services/order-invoice-sync.service'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { AUTHORIZATION_CACHE } from '@shared/authorization/domain/ports/authorization-cache.port'
import { PERMISSION_REPOSITORY } from '@shared/authorization/domain/ports/permission-repository.port'
import { AuthorizationService } from '@shared/authorization/infrastructure/authorization.service'
import { RequestScopedAuthorizationCache } from '@shared/authorization/infrastructure/cache/request-scoped-authorization.cache'
import { PermissionRepository } from '@shared/authorization/infrastructure/repositories/permission.repository'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
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

describe('order invoice reads', () => {
  let module: TestingModule
  let prisma: PrismaService
  let tenantId: string
  let adminId: string
  let buyerId: string
  let strangerId: string
  let eventId: string
  const orderIds: string[] = []
  const client = {
    getSaleDocuments: jest.fn(),
    getDocumentFiles: jest.fn(),
    isConfigured: () => true,
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
        { provide: PERMISSION_REPOSITORY, useClass: PermissionRepository },
        { provide: AUTHORIZATION_CACHE, useClass: RequestScopedAuthorizationCache },
        AuthorizationService,
        { provide: AUTHORIZATION_SERVICE, useExisting: AuthorizationService },
        { provide: ORDER_READ_REPOSITORY, useClass: OrderReadRepository },
        {
          provide: EVENT_PAYOUT_METHOD_REPOSITORY,
          useValue: {
            findByEventId: async () => [],
          } satisfies Partial<IEventPayoutMethodRepository>,
        },
        { provide: RIKUCHIY_OUTBOX_REPOSITORY, useClass: RikuchiyOutboxRepository },
        { provide: ORDER_TAX_DOCUMENT_REPOSITORY, useClass: OrderTaxDocumentRepository },
        { provide: RIKUCHIY_CLIENT, useValue: client },
        { provide: MailService, useValue: { enqueue: jest.fn() } },
        OrderInvoiceStateRefresher,
        OrderInvoiceSyncService,
        GetOrderDetailHandler,
        GetMyOrderDetailHandler,
        GetOrderTaxDocumentFilesHandler,
        {
          provide: CdnUrlBuilder,
          useValue: { internalUrl: () => 'http://fake', galleryUrl: () => 'http://fake' },
        },
      ],
    }).compile()

    prisma = module.get(PrismaService)
    const tenant = await prisma.tenant.create({
      data: { name: 'Invoice Reads Tenant', is_platform: false, event_quota: 10 },
    })
    tenantId = tenant.id
    const template = await prisma.permissionTemplate.findUniqueOrThrow({ where: { key: 'tenant' } })
    const admin = await prisma.user.create({
      data: {
        email: `reads-admin-${randomUUID()}@test.local`,
        password_hash: 'x',
        permission_template_id: template.id,
        tenant_id: tenant.id,
      },
    })
    adminId = admin.id
    const buyer = await prisma.user.create({
      data: { email: `reads-buyer-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    buyerId = buyer.id
    const stranger = await prisma.user.create({
      data: { email: `reads-stranger-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    strangerId = stranger.id
    const event = await prisma.event.create({
      data: {
        name: 'Invoice Reads Event',
        slug: `invoice-reads-${randomUUID()}`,
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
      await prisma.user.deleteMany({ where: { id: { in: [adminId, buyerId, strangerId] } } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  beforeEach(() => {
    client.getSaleDocuments.mockReset()
    client.getDocumentFiles.mockReset()
  })

  async function createOrder(withBilling = true): Promise<string> {
    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyerId,
        status: 'paid',
        payment_method: 'transfer',
        subtotal: '3.00',
        snap_email: 'juan@correo.com',
        ...(withBilling
          ? {
              snap_billing_id_type: 'national_id' as const,
              snap_billing_id_number: '1710034065',
              snap_billing_legal_name: 'Juan Perez',
              snap_billing_email: 'juan@correo.com',
              snap_billing_address: null,
            }
          : {}),
      },
    })
    orderIds.push(order.id)
    await prisma.rikuchiyOutboxItem.create({
      data: {
        order_id: order.id,
        kind: 'emit',
        emission_id: randomUUID(),
        payload: {},
        status: 'sent',
        external_ref: order.id,
        created_at: new Date('2026-11-03T10:00:00Z'),
        sent_at: new Date('2026-11-03T10:00:00Z'),
      },
    })
    return order.id
  }

  const document = (
    externalRef: string,
    overrides: Partial<CachedTaxDocument> = {},
  ): CachedTaxDocument => ({
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
    ...overrides,
  })

  const files = {
    kind: 'files' as const,
    xml: { url: 'https://files.test/a.xml', expiresAt: '2026-11-03T12:00:00.000Z' },
    pdf: { url: 'https://files.test/a.pdf', expiresAt: '2026-11-03T12:00:00.000Z' },
  }

  it('refreshes the invoice live when the admin opens the order', async () => {
    const orderId = await createOrder()
    client.getSaleDocuments.mockResolvedValue([document(orderId)])

    const detail = await module
      .get(GetOrderDetailHandler)
      .execute(new GetOrderDetailQuery(orderId, adminId))

    expect(detail.invoice?.state).toBe('authorized')
    expect(detail.invoice?.canCorrect).toBe(false)
    expect(detail.invoice?.documents).toHaveLength(1)
    expect(detail.invoice?.documents[0]).toMatchObject({
      type: 'invoice',
      downloadable: true,
      resendable: true,
    })
    expect(detail.billing).toEqual({
      idType: 'national_id',
      idNumber: '1710034065',
      legalName: 'Juan Perez',
      email: 'juan@correo.com',
      address: null,
    })
  })

  it('answers from the cached copy when rikuchiy is down', async () => {
    const orderId = await createOrder()
    client.getSaleDocuments.mockResolvedValueOnce([document(orderId)])
    await module.get(GetOrderDetailHandler).execute(new GetOrderDetailQuery(orderId, adminId))
    client.getSaleDocuments.mockResolvedValue(null)

    const detail = await module
      .get(GetOrderDetailHandler)
      .execute(new GetOrderDetailQuery(orderId, adminId))

    expect(detail.invoice?.state).toBe('authorized')
    expect(detail.invoice?.documents).toHaveLength(1)
  })

  it('returns a null invoice and billing for an order never invoiced', async () => {
    const order = await prisma.order.create({
      data: { event_id: eventId, user_id: buyerId, status: 'paid' },
    })
    orderIds.push(order.id)

    const detail = await module
      .get(GetOrderDetailHandler)
      .execute(new GetOrderDetailQuery(order.id, adminId))

    expect(detail.invoice).toBeNull()
    expect(detail.billing).toBeNull()
  })

  it('hides intake rejections from the buyer', async () => {
    const order = await prisma.order.create({
      data: { event_id: eventId, user_id: buyerId, status: 'paid' },
    })
    orderIds.push(order.id)
    await prisma.rikuchiyOutboxItem.create({
      data: {
        order_id: order.id,
        kind: 'emit',
        emission_id: randomUUID(),
        payload: {},
        status: 'rejected',
        rejection_reason: 'identification invalid',
        external_ref: order.id,
      },
    })
    client.getSaleDocuments.mockResolvedValue([])

    const mine = await module
      .get(GetMyOrderDetailHandler)
      .execute(new GetMyOrderDetailQuery(buyerId, order.id))
    const admin = await module
      .get(GetOrderDetailHandler)
      .execute(new GetOrderDetailQuery(order.id, adminId))

    expect(mine.invoice).toMatchObject({
      state: 'in_process',
      rejectionMessages: [],
      canCorrect: false,
    })
    expect(admin.invoice).toMatchObject({
      state: 'rejected',
      rejection: { source: 'intake', messages: ['identification invalid'] },
      canCorrect: true,
    })
  })

  it('returns signed files for a document of the buyer own order', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(GetMyOrderDetailHandler).execute(new GetMyOrderDetailQuery(buyerId, orderId))
    client.getDocumentFiles.mockResolvedValue(files)

    const result = await module
      .get(GetOrderTaxDocumentFilesHandler)
      .execute(new GetOrderTaxDocumentFilesQuery(orderId, invoice.id, buyerId, 'buyer'))

    expect(result).toEqual({
      xml: { url: files.xml.url, expiresAt: files.xml.expiresAt },
      pdf: { url: files.pdf.url, expiresAt: files.pdf.expiresAt },
    })
    expect(client.getDocumentFiles).toHaveBeenCalledWith(invoice.id)
  })

  it('answers 404 for a document of another order or another buyer, without calling rikuchiy', async () => {
    const orderId = await createOrder()
    const otherOrderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(GetMyOrderDetailHandler).execute(new GetMyOrderDetailQuery(buyerId, orderId))
    client.getSaleDocuments.mockResolvedValue([])
    await module
      .get(GetMyOrderDetailHandler)
      .execute(new GetMyOrderDetailQuery(buyerId, otherOrderId))
    const handler = module.get(GetOrderTaxDocumentFilesHandler)

    await expect(
      handler.execute(
        new GetOrderTaxDocumentFilesQuery(otherOrderId, invoice.id, buyerId, 'buyer'),
      ),
    ).rejects.toMatchObject({ httpStatus: 404 })
    await expect(
      handler.execute(new GetOrderTaxDocumentFilesQuery(orderId, invoice.id, strangerId, 'buyer')),
    ).rejects.toMatchObject({ httpStatus: 404 })
    await expect(
      handler.execute(new GetOrderTaxDocumentFilesQuery(orderId, randomUUID(), buyerId, 'buyer')),
    ).rejects.toMatchObject({ httpStatus: 404 })
    expect(client.getDocumentFiles).not.toHaveBeenCalled()
  })

  it('answers 404 for a document that is not downloadable yet', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId, { state: 'received', authorizedAt: null })
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(GetOrderDetailHandler).execute(new GetOrderDetailQuery(orderId, adminId))

    await expect(
      module
        .get(GetOrderTaxDocumentFilesHandler)
        .execute(new GetOrderTaxDocumentFilesQuery(orderId, invoice.id, adminId, 'admin')),
    ).rejects.toMatchObject({ httpStatus: 404 })
    expect(client.getDocumentFiles).not.toHaveBeenCalled()
  })

  it('maps files not stored yet to order.invoice_files_not_ready', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(GetOrderDetailHandler).execute(new GetOrderDetailQuery(orderId, adminId))
    client.getDocumentFiles.mockResolvedValue({ kind: 'not_stored' })

    await expect(
      module
        .get(GetOrderTaxDocumentFilesHandler)
        .execute(new GetOrderTaxDocumentFilesQuery(orderId, invoice.id, adminId, 'admin')),
    ).rejects.toMatchObject({ httpStatus: 422, messageKey: 'order.invoice_files_not_ready' })
  })

  it('maps an unavailable rikuchiy to a 502', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(GetOrderDetailHandler).execute(new GetOrderDetailQuery(orderId, adminId))
    client.getDocumentFiles.mockResolvedValue({ kind: 'unavailable' })

    await expect(
      module
        .get(GetOrderTaxDocumentFilesHandler)
        .execute(new GetOrderTaxDocumentFilesQuery(orderId, invoice.id, adminId, 'admin')),
    ).rejects.toMatchObject({ httpStatus: 502 })
  })
})
