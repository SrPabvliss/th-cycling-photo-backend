import { BuyerPurchaseSnapshotService } from '@orders/application/services/buyer-purchase-snapshot.service'
import { Order } from '@orders/domain/entities'
import { PaymentMethod } from '@orders/domain/value-objects/payment-method.vo'
import { PreviewLink } from '@previews/domain/entities'
import { PreviewLinkStatus } from '@previews/domain/value-objects/preview-link-status.vo'
import { AppException } from '@shared/domain'
import { CreateOrderFromPreviewCommand } from './create-order-from-preview.command'
import { CreateOrderFromPreviewHandler } from './create-order-from-preview.handler'

const BILLING = {
  id: 'ba-1',
  idType: 'national_id',
  idNumber: '1710034065',
  legalName: 'Jane Doe',
  email: 'jane@example.com',
  address: 'Quito',
}

const previewLink = () =>
  PreviewLink.fromPersistence({
    id: 'pl-1',
    token: 'tok',
    eventId: 'ev-1',
    status: PreviewLinkStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 86_400_000),
    viewedAt: null,
    createdAt: new Date(),
    createdById: 'org-1',
  })

const command = (method: 'card' | 'transfer' = PaymentMethod.TRANSFER, photoIds = ['p1', 'p2']) =>
  new CreateOrderFromPreviewCommand('tok', photoIds, 'u1', null, '42', 'Élite', 'ba-1', method)

function setup(
  options: { existing?: Order | null; acceptsCard?: boolean; consent?: unknown } = {},
) {
  const persisted: { order: Order; items: unknown[]; snap: Record<string, unknown> }[] = []
  const orderWriteRepo = {
    lockAndUpsertPreviewOrder: jest.fn(async (_id: string, build) => {
      const built = await build(options.existing ?? null, {})
      persisted.push(built)
      return built.order
    }),
  }
  const orderReadRepo = {
    getPreviewPhotoIds: jest.fn().mockResolvedValue(['p1', 'p2', 'p3']),
    getDetail: jest.fn().mockResolvedValue({ eventName: 'Andes Enduro' }),
  }
  const link = previewLink()
  const previewReadRepo = { findByToken: jest.fn().mockResolvedValue(link) }
  const previewWriteRepo = { save: jest.fn().mockResolvedValue(link) }
  const transactionWriteRepo = { expireOpenByOrderId: jest.fn().mockResolvedValue(undefined) }
  const buyerSnapshot = new BuyerPurchaseSnapshotService(
    {
      getUserSnapData: jest.fn().mockResolvedValue({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: null,
        countryId: 1,
        provinceId: null,
        cantonId: null,
      }),
    } as never,
    { findActiveById: jest.fn().mockResolvedValue(BILLING) } as never,
    {
      findActive: jest
        .fn()
        .mockResolvedValue(
          options.consent === undefined
            ? { acceptedAt: new Date('2026-11-01'), ip: '190.1.1.1' }
            : options.consent,
        ),
    } as never,
  )
  const receiverResolver = { acceptsCard: jest.fn().mockResolvedValue(options.acceptsCard ?? true) }
  const notifications = { emitOrderCreated: jest.fn() }

  const handler = new CreateOrderFromPreviewHandler(
    orderWriteRepo as never,
    orderReadRepo as never,
    previewReadRepo as never,
    previewWriteRepo as never,
    transactionWriteRepo as never,
    buyerSnapshot,
    receiverResolver as never,
    notifications as never,
  )
  return { handler, persisted, notifications, transactionWriteRepo, link }
}

const draftOf = (userId: string) =>
  Order.createDraft({
    previewLinkId: 'pl-1',
    eventId: 'ev-1',
    userId,
    notes: null,
    paymentMethod: PaymentMethod.CARD,
  })

describe('CreateOrderFromPreviewHandler', () => {
  it('places a billable pending order on transfer: priced items, buyer and billing snapshot', async () => {
    const { handler, persisted, notifications, link } = setup()

    const result = await handler.execute(command())

    const { order, items, snap } = persisted[0]
    expect(order.isDraft).toBe(false)
    expect(order.subtotal).toBe(8)
    expect(items).toEqual([
      { photoId: 'p1', unitPrice: 4 },
      { photoId: 'p2', unitPrice: 4 },
    ])
    expect(snap).toMatchObject({
      snapCategoryName: 'Élite',
      snapBillingAccountId: 'ba-1',
      snapBillingIdNumber: '1710034065',
      snapInvoiceConsentIp: '190.1.1.1',
    })
    expect(result).toEqual({
      id: order.id,
      subtotal: 8,
      currency: 'USD',
      photoCount: 2,
      method: 'transfer',
    })
    expect(notifications.emitOrderCreated).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'Andes Enduro', subtotal: 8 }),
    )
    expect(link.status).toBe(PreviewLinkStatus.CONVERTED)
  })

  it('leaves a draft for the payment intent on card, without notifying', async () => {
    const { handler, persisted, notifications } = setup()

    await handler.execute(command(PaymentMethod.CARD))

    expect(persisted[0].order.isDraft).toBe(true)
    expect(notifications.emitOrderCreated).not.toHaveBeenCalled()
  })

  it('rewrites the buyer own abandoned card draft instead of refusing', async () => {
    const draft = draftOf('u1')
    const { handler, persisted, transactionWriteRepo } = setup({ existing: draft })

    const result = await handler.execute(command(PaymentMethod.TRANSFER, ['p3']))

    expect(result.id).toBe(draft.id)
    expect(persisted[0].order.isDraft).toBe(false)
    expect(persisted[0].items).toEqual([{ photoId: 'p3', unitPrice: 4 }])
    expect(transactionWriteRepo.expireOpenByOrderId).toHaveBeenCalledWith(draft.id, {})
  })

  it.each([
    [
      'a submitted order',
      () => Order.create({ previewLinkId: 'pl-1', eventId: 'ev-1', userId: 'u1', notes: null }),
    ],
    ['another buyer draft', () => draftOf('u2')],
  ])('refuses when the link already has %s', async (_label, existing) => {
    const { handler } = setup({ existing: existing() })

    const error = await handler.execute(command()).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.messageKey).toBe('order.already_submitted')
  })

  it('refuses card when the event receiver does not accept it', async () => {
    const { handler, persisted } = setup({ acceptsCard: false })

    const error = await handler.execute(command(PaymentMethod.CARD)).catch((e) => e)

    expect(error.messageKey).toBe('payment.card_unavailable')
    expect(persisted).toHaveLength(0)
  })

  it('requires the electronic-invoice consent, like the checkout', async () => {
    const { handler, persisted } = setup({ consent: null })

    const error = await handler.execute(command()).catch((e) => e)

    expect(error.messageKey).toBe('billing.invoice_consent_required')
    expect(persisted).toHaveLength(0)
  })

  it('refuses photos outside the preview', async () => {
    const { handler } = setup()

    const error = await handler.execute(command(PaymentMethod.TRANSFER, ['p9'])).catch((e) => e)

    expect(error.messageKey).toBe('order.photos_not_in_preview')
  })
})
