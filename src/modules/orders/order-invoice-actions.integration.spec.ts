import { randomUUID } from 'node:crypto'
import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  type IEventPayoutMethodRepository,
} from '@events/domain/ports'
import { MailService } from '@mail/application/services/mail.service'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { CorrectMyOrderBillingCommand } from '@orders/application/commands/correct-my-order-billing/correct-my-order-billing.command'
import { CorrectMyOrderBillingHandler } from '@orders/application/commands/correct-my-order-billing/correct-my-order-billing.handler'
import { CorrectOrderBillingCommand } from '@orders/application/commands/correct-order-billing/correct-order-billing.command'
import { CorrectOrderBillingHandler } from '@orders/application/commands/correct-order-billing/correct-order-billing.handler'
import { ResendOrderTaxDocumentCommand } from '@orders/application/commands/resend-order-tax-document/resend-order-tax-document.command'
import { ResendOrderTaxDocumentHandler } from '@orders/application/commands/resend-order-tax-document/resend-order-tax-document.handler'
import { RetryOrderAnnulmentCommand } from '@orders/application/commands/retry-order-annulment/retry-order-annulment.command'
import { RetryOrderAnnulmentHandler } from '@orders/application/commands/retry-order-annulment/retry-order-annulment.handler'
import { GetOrderDetailHandler } from '@orders/application/queries/get-order-detail/get-order-detail.handler'
import { ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import { OrderInvoiceSyncProcessor } from '@orders/infrastructure/processors/order-invoice-sync.processor'
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
import type { InvoiceStateView } from '@shared/rikuchiy/domain/order-invoice-state'
import {
  type CachedTaxDocument,
  INVOICE_SOURCE_READER,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_CLIENT,
  RIKUCHIY_INVOICE_REQUESTER,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '@shared/rikuchiy/domain/ports'
import { RikuchiyDeliveryProcessor } from '@shared/rikuchiy/infrastructure/processors/rikuchiy-delivery.processor'
import { InvoiceSourceReader } from '@shared/rikuchiy/infrastructure/repositories/invoice-source.reader'
import { OrderTaxDocumentRepository } from '@shared/rikuchiy/infrastructure/repositories/order-tax-document.repository'
import { RikuchiyOutboxRepository } from '@shared/rikuchiy/infrastructure/repositories/rikuchiy-outbox.repository'
import { OrderInvoiceStateRefresher } from '@shared/rikuchiy/infrastructure/services/order-invoice-state-refresher.service'
import { RikuchiyInvoiceRequesterService } from '@shared/rikuchiy/infrastructure/services/rikuchiy-invoice-requester.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

describe('order invoice actions', () => {
  let module: TestingModule
  let prisma: PrismaService
  let tenantId: string
  let adminId: string
  let buyerId: string
  let eventId: string
  const orderIds: string[] = []
  const extraUserIds: string[] = []
  const client = {
    getSaleDocuments: jest.fn(),
    getDocumentFiles: jest.fn(),
    resend: jest.fn(),
    validateIdentification: jest.fn(),
    emit: jest.fn(),
    annul: jest.fn(),
    isConfigured: () => true,
  }
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
        { provide: MailService, useValue: mailService },
        OrderInvoiceStateRefresher,
        OrderInvoiceSyncService,
        GetOrderDetailHandler,
        ResendOrderTaxDocumentHandler,
        { provide: INVOICE_SOURCE_READER, useClass: InvoiceSourceReader },
        { provide: RIKUCHIY_INVOICE_REQUESTER, useClass: RikuchiyInvoiceRequesterService },
        CorrectOrderBillingHandler,
        CorrectMyOrderBillingHandler,
        RetryOrderAnnulmentHandler,
        RikuchiyDeliveryProcessor,
        OrderInvoiceSyncProcessor,
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
        first_name: 'Ana',
        last_name: 'Operadora',
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
      await prisma.user.deleteMany({ where: { id: { in: [adminId, buyerId, ...extraUserIds] } } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  beforeEach(() => {
    client.getSaleDocuments.mockReset()
    client.getDocumentFiles.mockReset()
    client.resend.mockReset()
    client.validateIdentification.mockReset()
    client.validateIdentification.mockResolvedValue(null)
    client.emit.mockReset()
    client.annul.mockReset()
    mailService.enqueue.mockReset()
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

  async function deliverPending(orderId: string): Promise<void> {
    const repository = module.get<RikuchiyOutboxRepository>(RIKUCHIY_OUTBOX_REPOSITORY)
    const findPending = repository.findPending.bind(repository)
    const onlyThisOrder = jest
      .spyOn(repository, 'findPending')
      .mockImplementation(async (limit) =>
        (await findPending(limit * 20)).filter((item) => item.orderId === orderId),
      )
    await module.get(RikuchiyDeliveryProcessor).process()
    onlyThisOrder.mockRestore()
  }

  async function runSyncJob(orderId: string): Promise<string[]> {
    const service = module.get(OrderInvoiceSyncService)
    const syncOrder = service.syncOrder.bind(service)
    const untouched = { state: 'none' } as InvoiceStateView
    const visited: string[] = []
    const onlyThisOrder = jest.spyOn(service, 'syncOrder').mockImplementation(async (id) => {
      visited.push(id)
      return id === orderId ? syncOrder(id) : untouched
    })
    await module.get(OrderInvoiceSyncProcessor).process()
    onlyThisOrder.mockRestore()
    return visited
  }

  const orderOf = (orderId: string) => prisma.order.findUniqueOrThrow({ where: { id: orderId } })

  const resend = (orderId: string, taxDocumentId: string) =>
    module
      .get(ResendOrderTaxDocumentHandler)
      .execute(new ResendOrderTaxDocumentCommand(orderId, taxDocumentId, adminId))

  it('asks rikuchiy to resend as the operator', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(OrderInvoiceSyncService).syncOrder(orderId)
    client.resend.mockResolvedValue('accepted')

    client.getSaleDocuments.mockClear()

    const result = await resend(orderId, invoice.id)

    expect(result).toEqual({ id: invoice.id })
    expect(client.resend).toHaveBeenCalledWith(invoice.id, {
      id: adminId,
      name: 'Ana Operadora',
    })
    expect(client.getSaleDocuments).toHaveBeenCalledTimes(1)
  })

  it('falls back to the email when the admin has no name', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(OrderInvoiceSyncService).syncOrder(orderId)
    client.resend.mockResolvedValue('accepted')
    const template = await prisma.permissionTemplate.findUniqueOrThrow({ where: { key: 'tenant' } })
    const nameless = await prisma.user.create({
      data: {
        email: `reads-nameless-${randomUUID()}@test.local`,
        password_hash: 'x',
        permission_template_id: template.id,
        tenant_id: tenantId,
      },
    })
    extraUserIds.push(nameless.id)

    await module
      .get(ResendOrderTaxDocumentHandler)
      .execute(new ResendOrderTaxDocumentCommand(orderId, invoice.id, nameless.id))

    expect(client.resend).toHaveBeenCalledWith(invoice.id, {
      id: nameless.id,
      name: nameless.email,
    })
  })

  it('refuses a user without the permission and never calls rikuchiy', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(OrderInvoiceSyncService).syncOrder(orderId)

    await expect(
      module
        .get(ResendOrderTaxDocumentHandler)
        .execute(new ResendOrderTaxDocumentCommand(orderId, invoice.id, buyerId)),
    ).rejects.toThrow()
    expect(client.resend).not.toHaveBeenCalled()
  })

  it('refuses a document that is not resendable', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId, { state: 'received', authorizedAt: null })
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(OrderInvoiceSyncService).syncOrder(orderId)

    await expect(resend(orderId, invoice.id)).rejects.toMatchObject({ httpStatus: 404 })
    await expect(resend(orderId, randomUUID())).rejects.toMatchObject({ httpStatus: 404 })
    expect(client.resend).not.toHaveBeenCalled()
  })

  it('maps a document rikuchiy refuses to resend to a conflict', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(OrderInvoiceSyncService).syncOrder(orderId)
    client.resend.mockResolvedValue('not_resendable')
    client.getSaleDocuments.mockClear()

    await expect(resend(orderId, invoice.id)).rejects.toMatchObject({
      httpStatus: 409,
      messageKey: 'order.invoice_not_resendable',
    })
    expect(client.getSaleDocuments).not.toHaveBeenCalled()
  })

  it('maps an unavailable rikuchiy to a 502', async () => {
    const orderId = await createOrder()
    const invoice = document(orderId)
    client.getSaleDocuments.mockResolvedValue([invoice])
    await module.get(OrderInvoiceSyncService).syncOrder(orderId)
    client.resend.mockResolvedValue('unavailable')
    client.getSaleDocuments.mockClear()

    await expect(resend(orderId, invoice.id)).rejects.toMatchObject({ httpStatus: 502 })
    expect(client.getSaleDocuments).not.toHaveBeenCalled()
  })

  describe('correcting the billing data', () => {
    const previousPayload = (orderId: string) => ({
      emissionId: randomUUID(),
      sale: { app: 'cycling-photo', externalRef: orderId },
      buyer: {
        idType: '05',
        idNumber: '1710034065',
        legalName: 'Juan Perez',
        address: null,
        email: 'juan@correo.com',
        phone: null,
      },
      lines: [
        {
          code: 'FOTO',
          description: 'Fotografía digital',
          quantity: 1,
          grossPrice: '3.00',
          additionalDetails: [{ name: 'Archivo', value: 'IMG_1' }],
        },
      ],
      additionalInfo: [{ name: 'Pedido', value: orderId.slice(0, 8) }],
      total: '3.00',
      paymentMethod: '20',
      consent: { givenAt: '2026-11-03T10:00:00.000Z', ip: '10.0.0.1' },
    })

    async function createRejectedOrder(source: 'sri' | 'intake'): Promise<string> {
      const orderId = await createOrder()
      await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: orderId } })
      await prisma.rikuchiyOutboxItem.create({
        data: {
          order_id: orderId,
          kind: 'emit',
          emission_id: randomUUID(),
          payload: previousPayload(orderId),
          status: source === 'sri' ? 'sent' : 'rejected',
          rejection_reason: source === 'sri' ? null : 'Identificación inválida',
          external_ref: orderId,
          created_at: new Date('2026-11-03T10:00:00Z'),
          sent_at: new Date('2026-11-03T10:00:00Z'),
        },
      })
      if (source === 'sri') {
        client.getSaleDocuments.mockResolvedValue([
          document(orderId, { state: 'not_authorized', authorizedAt: null }),
        ])
        await module.get(OrderInvoiceSyncService).syncOrder(orderId)
      }
      return orderId
    }

    const input = {
      idType: 'national_id' as const,
      idNumber: ' 1710034065 ',
      legalName: '  Juana Perez ',
      email: 'Juana@Correo.com',
      address: ' Av. Amazonas ',
    }

    const correctAsAdmin = (orderId: string) =>
      module
        .get(CorrectOrderBillingHandler)
        .execute(
          new CorrectOrderBillingCommand(
            orderId,
            adminId,
            input.idType,
            input.idNumber,
            input.legalName,
            input.email,
            input.address,
          ),
        )

    const correctAsBuyer = (orderId: string) =>
      module
        .get(CorrectMyOrderBillingHandler)
        .execute(
          new CorrectMyOrderBillingCommand(
            buyerId,
            orderId,
            input.idType,
            input.idNumber,
            input.legalName,
            input.email,
            input.address,
          ),
        )

    it('queues a corrected emission on the same sale reference', async () => {
      const orderId = await createRejectedOrder('sri')
      const before = await prisma.rikuchiyOutboxItem.findFirstOrThrow({
        where: { order_id: orderId },
      })

      await expect(correctAsAdmin(orderId)).resolves.toEqual({ id: orderId })

      const rows = await prisma.rikuchiyOutboxItem.findMany({
        where: { order_id: orderId },
        orderBy: { created_at: 'asc' },
      })
      expect(rows).toHaveLength(2)
      const [previous, corrected] = rows
      expect(corrected.status).toBe('pending')
      expect(corrected.kind).toBe('emit')
      expect(corrected.external_ref).toBe(previous.external_ref)
      expect(corrected.emission_id).not.toBe(before.emission_id)
      const oldPayload = previous.payload as ReturnType<typeof previousPayload>
      const newPayload = corrected.payload as ReturnType<typeof previousPayload>
      expect(newPayload.emissionId).toBe(corrected.emission_id)
      expect(newPayload.sale).toEqual(oldPayload.sale)
      expect(newPayload.lines).toEqual(oldPayload.lines)
      expect(newPayload.total).toBe(oldPayload.total)
      expect(newPayload.additionalInfo).toEqual(oldPayload.additionalInfo)
      expect(newPayload.buyer).toEqual({
        idType: '05',
        idNumber: '1710034065',
        legalName: 'Juana Perez',
        address: 'Av. Amazonas',
        email: 'juana@correo.com',
        phone: null,
      })
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
      expect(order.snap_billing_legal_name).toBe('Juana Perez')
      expect(order.snap_billing_email).toBe('juana@correo.com')
      expect(order.snap_billing_address).toBe('Av. Amazonas')
    })

    it('follows a delivered correction to a second SRI rejection and emails again', async () => {
      const orderId = await createRejectedOrder('sri')
      expect(mailService.enqueue).toHaveBeenCalledTimes(1)
      const invoice = await prisma.orderTaxDocument.findFirstOrThrow({
        where: { order_id: orderId },
      })

      await correctAsAdmin(orderId)
      expect((await orderOf(orderId)).invoice_rejection_notified_at).toBeNull()

      client.emit.mockResolvedValue({ kind: 'accepted', taxDocumentId: invoice.id })
      await deliverPending(orderId)

      const delivered = await orderOf(orderId)
      expect(delivered.invoice_state).toBe('in_process')
      expect(delivered.invoice_synced_at).toBeNull()

      client.getSaleDocuments.mockResolvedValue([
        document(orderId, { id: invoice.id, state: 'returned', authorizedAt: null }),
      ])
      const visited = await runSyncJob(orderId)

      expect(visited).toContain(orderId)
      const synced = await orderOf(orderId)
      expect(synced.invoice_state).toBe('rejected')
      expect(synced.invoice_synced_at).not.toBeNull()
      expect(mailService.enqueue).toHaveBeenCalledTimes(2)
    })

    it('leaves a pending correction alone when nothing was delivered yet', async () => {
      const orderId = await createRejectedOrder('sri')
      await correctAsAdmin(orderId)

      client.getSaleDocuments.mockResolvedValue([
        document(orderId, { state: 'not_authorized', authorizedAt: null }),
      ])
      await module.get(OrderInvoiceSyncService).syncOrder(orderId)

      expect((await orderOf(orderId)).invoice_state).toBe('in_process')
      expect(mailService.enqueue).toHaveBeenCalledTimes(1)
    })

    it('lets the buyer correct only a rejection from the SRI', async () => {
      const intake = await createRejectedOrder('intake')
      await expect(correctAsBuyer(intake)).rejects.toMatchObject({
        httpStatus: 409,
        messageKey: 'order.invoice_not_correctable',
      })
      await expect(correctAsAdmin(intake)).resolves.toEqual({ id: intake })

      const sri = await createRejectedOrder('sri')
      await expect(correctAsBuyer(sri)).resolves.toEqual({ id: sri })
    })

    it('refuses a second correction while one is pending', async () => {
      const orderId = await createRejectedOrder('sri')

      await expect(correctAsAdmin(orderId)).resolves.toEqual({ id: orderId })
      await expect(correctAsAdmin(orderId)).rejects.toMatchObject({
        httpStatus: 409,
        messageKey: 'order.invoice_not_correctable',
      })

      const pending = await prisma.rikuchiyOutboxItem.count({
        where: { order_id: orderId, status: 'pending' },
      })
      expect(pending).toBe(1)
    })

    it('rolls the billing data back when the queue refuses the correction', async () => {
      const orderId = await createRejectedOrder('sri')
      const requester = module.get(RIKUCHIY_INVOICE_REQUESTER)
      const correct = jest.spyOn(requester, 'correct').mockResolvedValueOnce(false)

      await expect(correctAsAdmin(orderId)).rejects.toMatchObject({
        httpStatus: 409,
        messageKey: 'order.invoice_not_correctable',
      })
      correct.mockRestore()

      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
      expect(order.snap_billing_legal_name).toBe('Juan Perez')
    })

    it('refuses an identification the SRI does not know', async () => {
      const orderId = await createRejectedOrder('sri')
      client.validateIdentification.mockResolvedValue({ valid: false, reason: 'unknown' })

      await expect(correctAsAdmin(orderId)).rejects.toMatchObject({
        httpStatus: 422,
        messageKey: 'billing.identification_invalid',
      })
      expect(await prisma.rikuchiyOutboxItem.count({ where: { order_id: orderId } })).toBe(1)
    })

    it('hides the order from another buyer', async () => {
      const orderId = await createRejectedOrder('sri')
      await expect(
        module
          .get(CorrectMyOrderBillingHandler)
          .execute(
            new CorrectMyOrderBillingCommand(
              adminId,
              orderId,
              input.idType,
              input.idNumber,
              input.legalName,
              input.email,
              input.address,
            ),
          ),
      ).rejects.toMatchObject({ httpStatus: 404 })
    })

    it('leaves the billing account untouched', async () => {
      const orderId = await createRejectedOrder('sri')
      const account = await prisma.billingAccount.create({
        data: {
          user_id: buyerId,
          id_type: 'national_id',
          id_number: '1710034065',
          legal_name: 'Juan Perez',
          email: 'juan@correo.com',
          is_default: true,
        },
      })
      await prisma.order.update({
        where: { id: orderId },
        data: { snap_billing_account_id: account.id },
      })

      await correctAsBuyer(orderId)

      const after = await prisma.billingAccount.findUniqueOrThrow({ where: { id: account.id } })
      expect(after.legal_name).toBe('Juan Perez')
      expect(after.email).toBe('juan@correo.com')
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
      expect(order.snap_billing_account_id).toBe(account.id)
      await prisma.order.update({ where: { id: orderId }, data: { snap_billing_account_id: null } })
      await prisma.billingAccount.delete({ where: { id: account.id } })
    })
  })
  describe('retrying the annulment', () => {
    async function createRejectedCreditNoteOrder(): Promise<string> {
      const orderId = await createOrder()
      await prisma.rikuchiyOutboxItem.create({
        data: {
          order_id: orderId,
          kind: 'annul',
          emission_id: randomUUID(),
          payload: { emissionId: randomUUID(), reason: 'Pedido cancelado' },
          status: 'sent',
          external_ref: orderId,
          created_at: new Date('2026-11-03T11:00:00Z'),
          sent_at: new Date('2026-11-03T11:00:00Z'),
        },
      })
      client.getSaleDocuments.mockResolvedValue([
        document(orderId),
        document(orderId, { type: 'credit_note', state: 'not_authorized', authorizedAt: null }),
      ])
      await module.get(OrderInvoiceSyncService).syncOrder(orderId)
      return orderId
    }

    const retry = (orderId: string, userId = adminId) =>
      module
        .get(RetryOrderAnnulmentHandler)
        .execute(new RetryOrderAnnulmentCommand(orderId, userId))

    it('retries the annulment of a rejected credit note', async () => {
      const orderId = await createRejectedCreditNoteOrder()

      await expect(retry(orderId)).resolves.toEqual({ id: orderId })

      const annuls = await prisma.rikuchiyOutboxItem.findMany({
        where: { order_id: orderId, kind: 'annul' },
        orderBy: { created_at: 'asc' },
      })
      expect(annuls).toHaveLength(2)
      const [previous, retried] = annuls
      expect(retried.status).toBe('pending')
      expect(retried.external_ref).toBe(previous.external_ref)
      expect(retried.emission_id).not.toBe(previous.emission_id)
      expect(retried.payload).toEqual({
        emissionId: retried.emission_id,
        reason: 'Pedido cancelado',
      })
    })

    it('follows a delivered annulment retry back to the SRI without emailing the buyer', async () => {
      const orderId = await createRejectedCreditNoteOrder()
      const creditNote = await prisma.orderTaxDocument.findFirstOrThrow({
        where: { order_id: orderId, type: 'credit_note' },
      })
      const invoice = await prisma.orderTaxDocument.findFirstOrThrow({
        where: { order_id: orderId, type: 'invoice' },
      })

      await retry(orderId)
      client.annul.mockResolvedValue({
        kind: 'accepted',
        outcome: 'credit_note',
        creditNoteId: creditNote.id,
      })
      await deliverPending(orderId)

      const delivered = await orderOf(orderId)
      expect(delivered.invoice_state).toBe('in_process')
      expect(delivered.invoice_synced_at).toBeNull()

      client.getSaleDocuments.mockResolvedValue([
        document(orderId, { id: invoice.id }),
        document(orderId, {
          id: creditNote.id,
          type: 'credit_note',
          state: 'returned',
          authorizedAt: null,
        }),
      ])
      const visited = await runSyncJob(orderId)

      expect(visited).toContain(orderId)
      expect((await orderOf(orderId)).invoice_state).toBe('rejected')
      expect(mailService.enqueue).not.toHaveBeenCalled()
    })

    it('refuses a second retry while one is pending', async () => {
      const orderId = await createRejectedCreditNoteOrder()

      await retry(orderId)
      await expect(retry(orderId)).rejects.toMatchObject({
        httpStatus: 409,
        messageKey: 'order.invoice_annulment_not_retryable',
      })
      expect(
        await prisma.rikuchiyOutboxItem.count({
          where: { order_id: orderId, kind: 'annul', status: 'pending' },
        }),
      ).toBe(1)
    })

    it('refuses an invoice whose credit note is not rejected', async () => {
      const orderId = await createOrder()
      await expect(retry(orderId)).rejects.toMatchObject({
        httpStatus: 409,
        messageKey: 'order.invoice_annulment_not_retryable',
      })
    })

    it('refuses a user without the permission', async () => {
      const orderId = await createRejectedCreditNoteOrder()
      await expect(retry(orderId, buyerId)).rejects.toMatchObject({ httpStatus: 404 })
    })
  })

  describe('cancelling while the emission is on its way', () => {
    it('records the accepted emission and annuls it, so the card shows the annulment', async () => {
      const orderId = await createOrder()
      await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: orderId } })
      await prisma.rikuchiyOutboxItem.create({
        data: {
          order_id: orderId,
          kind: 'emit',
          emission_id: randomUUID(),
          payload: { emissionId: randomUUID() },
          status: 'pending',
          external_ref: orderId,
          created_at: new Date('2026-11-03T10:00:00Z'),
        },
      })
      const taxDocumentId = randomUUID()
      const requester = module.get<RikuchiyInvoiceRequesterService>(RIKUCHIY_INVOICE_REQUESTER)
      client.emit.mockImplementation(async () => {
        await prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } })
        await prisma.$transaction((tx) => requester.withdraw(orderId, 'cancelled', tx))
        return { kind: 'accepted', taxDocumentId }
      })

      await deliverPending(orderId)

      const rows = await prisma.rikuchiyOutboxItem.findMany({
        where: { order_id: orderId },
        orderBy: { created_at: 'asc' },
      })
      expect(rows.map((row) => [row.kind, row.status])).toEqual([
        ['emit', 'sent'],
        ['annul', 'pending'],
      ])
      expect(rows[0].tax_document_id).toBe(taxDocumentId)
      expect((await orderOf(orderId)).invoice_state).toBe('in_process')

      client.annul.mockResolvedValue({ kind: 'accepted', outcome: 'cancelled', creditNoteId: null })
      await deliverPending(orderId)
      client.getSaleDocuments.mockResolvedValue([
        document(orderId, { id: taxDocumentId, state: 'cancelled', authorizedAt: null }),
      ])
      await runSyncJob(orderId)

      expect((await orderOf(orderId)).invoice_state).toBe('annulled')
    })
  })
})
