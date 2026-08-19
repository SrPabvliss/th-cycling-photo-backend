import { AuditContext } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { Order } from '../../../domain/entities'
import type { OrderDetailProjection } from '../../projections/order-detail.projection'
import { SendDeliveryCommand } from './send-delivery.command'
import { SendDeliveryHandler } from './send-delivery.handler'

const unrestrictedScope = EventScope.unrestricted()

function buildPaidOrder(): Order {
  const order = Order.create({
    previewLinkId: null,
    eventId: 'event-1',
    userId: 'user-1',
    notes: null,
  })
  order.confirmPayment('admin-0')
  return order
}

function buildGiftedOrder(): Order {
  const order = Order.create({
    previewLinkId: null,
    eventId: 'event-1',
    userId: 'user-1',
    notes: null,
  })
  order.markAsGift('admin-0')
  return order
}

function buildDetail(overrides: Partial<OrderDetailProjection> = {}): OrderDetailProjection {
  return {
    id: 'order-1',
    status: 'paid',
    notes: null,
    createdAt: new Date(),
    notifiedAt: null,
    paidAt: new Date(),
    deliveredAt: null,
    cancelledAt: null,
    userName: 'Pablo Villacres',
    snapFirstName: 'Pablo',
    snapLastName: 'Villacres',
    snapWhatsapp: '0999999999',
    snapEmail: 'buyer@example.com',
    eventName: 'Vuelta al Cotopaxi',
    subtotal: '30.00',
    snapCurrency: 'USD',
    paymentMethod: 'card',
    previewLinkToken: null,
    retouchProgress: { total: 3, retouched: 3 },
    photos: [
      { id: 'photo-1', filename: 'a.jpg', publicSlug: 'a', thumbnailUrl: '', fullUrl: '' },
      { id: 'photo-2', filename: 'b.jpg', publicSlug: 'b', thumbnailUrl: '', fullUrl: '' },
      { id: 'photo-3', filename: 'c.jpg', publicSlug: 'c', thumbnailUrl: '', fullUrl: '' },
    ],
    deliveryLink: null,
    ...overrides,
  }
}

function buildHandler(options: { detail?: Partial<OrderDetailProjection>; order?: Order } = {}): {
  handler: SendDeliveryHandler
  writeRepo: { save: jest.Mock; updateItemsDeliveredAs: jest.Mock }
  readRepo: { findByIdInScope: jest.Mock; getDetail: jest.Mock }
  authz: jest.Mocked<IAuthorizationService>
  deliveryReadRepo: { findActiveByOrderIds: jest.Mock }
  commandBus: { execute: jest.Mock }
  notifications: { emitOrderDelivered: jest.Mock }
  mailService: { enqueue: jest.Mock }
  configService: { getOrThrow: jest.Mock; get: jest.Mock }
  order: Order
} {
  const order = options.order ?? buildPaidOrder()
  const detail = buildDetail(options.detail)

  const writeRepo = {
    save: jest.fn().mockResolvedValue(order),
    updateItemsDeliveredAs: jest.fn().mockResolvedValue(undefined),
  }
  const readRepo = {
    findByIdInScope: jest.fn().mockResolvedValue(order),
    getDetail: jest.fn().mockResolvedValue(detail),
  }
  const authz = {
    can: jest.fn(),
    assert: jest.fn().mockResolvedValue(undefined),
    resolveEventScope: jest.fn().mockResolvedValue(unrestrictedScope),
  } as unknown as jest.Mocked<IAuthorizationService>
  const deliveryReadRepo = {
    findActiveByOrderIds: jest.fn().mockResolvedValue([]),
  }
  const commandBus = {
    execute: jest.fn().mockResolvedValue({
      id: 'link-1',
      token: 'tok-1',
      deliveryUrl: 'https://titantv.test/delivery/tok-1',
      expiresAt: new Date('2026-08-25T00:00:00.000Z'),
    }),
  }
  const notifications = { emitOrderDelivered: jest.fn() }
  const mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'app.webBaseUrl') return 'https://titantv.test'
      if (key === 'delivery.baseUrl') return 'https://titantv.test/delivery'
      return undefined
    }),
    get: jest.fn((_key: string, fallback?: unknown) => fallback),
  }

  const handler = new SendDeliveryHandler(
    writeRepo as never,
    readRepo as never,
    authz,
    deliveryReadRepo as never,
    commandBus as never,
    notifications as never,
    mailService as never,
    configService as never,
  )

  return {
    handler,
    writeRepo,
    readRepo,
    authz,
    deliveryReadRepo,
    commandBus,
    notifications,
    mailService,
    configService,
    order,
  }
}

describe('SendDeliveryHandler', () => {
  const audit = new AuditContext('operator-1')

  it('throws when the order does not exist', async () => {
    const { handler, readRepo, authz } = buildHandler()
    readRepo.findByIdInScope.mockResolvedValue(null)

    await expect(handler.execute(new SendDeliveryCommand('missing', audit))).rejects.toThrow(
      AppException,
    )
    expect(authz.assert).not.toHaveBeenCalled()
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the order exists but its event is outside the caller scope', async () => {
    const { handler, readRepo, writeRepo, authz } = buildHandler()
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValueOnce(restrictedScope)
    readRepo.findByIdInScope.mockResolvedValue(null)

    const error = await handler
      .execute(new SendDeliveryCommand('other-tenant-order', audit))
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.findByIdInScope).toHaveBeenCalledWith('other-tenant-order', restrictedScope)
    expect(authz.assert).not.toHaveBeenCalled()
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('asserts order.deliver against the order event and re-fetches detail with the same scope', async () => {
    const { handler, readRepo, authz, order } = buildHandler()

    await handler.execute(new SendDeliveryCommand(order.id, audit))

    expect(authz.assert).toHaveBeenCalledWith('operator-1', 'order.deliver', 'event-1')
    expect(readRepo.getDetail).toHaveBeenCalledWith(order.id, unrestrictedScope)
  })

  it('emails the buyer the download link', async () => {
    const { handler, mailService } = buildHandler()

    await handler.execute(new SendDeliveryCommand('order-1', audit))

    expect(mailService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        template: 'order-delivered',
        vars: expect.objectContaining({
          deliveryUrl: expect.stringContaining('tok-1'),
          eventName: 'Vuelta al Cotopaxi',
          photoCount: '3',
        }),
      }),
    )
  })

  it('delivers without an email when the order carries no address', async () => {
    const { handler, mailService } = buildHandler({ detail: { snapEmail: null } })

    const result = await handler.execute(new SendDeliveryCommand('order-1', audit))

    expect(result.deliveryUrl).toBeTruthy()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('still delivers when the mail queue refuses the job', async () => {
    const { handler, mailService, writeRepo } = buildHandler()
    mailService.enqueue.mockRejectedValue(new Error('queue down'))

    const result = await handler.execute(new SendDeliveryCommand('order-1', audit))

    expect(result.deliveryUrl).toBeTruthy()
    expect(writeRepo.save).toHaveBeenCalled()
  })

  it('delivers a gifted order via markGiftDelivered and sends an email with no total', async () => {
    const order = buildGiftedOrder()
    const markGiftDeliveredSpy = jest.spyOn(order, 'markGiftDelivered')
    const markDeliveredSpy = jest.spyOn(order, 'markDelivered')
    const { handler, mailService, writeRepo } = buildHandler({ order })

    const result = await handler.execute(new SendDeliveryCommand('order-1', audit))

    expect(result.deliveryUrl).toBeTruthy()
    expect(markGiftDeliveredSpy).toHaveBeenCalled()
    expect(markDeliveredSpy).not.toHaveBeenCalled()
    expect(writeRepo.save).toHaveBeenCalledWith(order)
    expect(mailService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        vars: expect.objectContaining({ total: '' }),
      }),
    )
  })
})
