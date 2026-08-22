import { AUTH_USER_REPOSITORY } from '@auth/domain/ports'
import { AuthUserRepository } from '@auth/infrastructure/repositories/auth-user.repository'
import { CheckoutCartCommand } from '@cart/application/commands/checkout-cart/checkout-cart.command'
import { CheckoutCartHandler } from '@cart/application/commands/checkout-cart/checkout-cart.handler'
import { CART_READ_REPOSITORY, CART_WRITE_REPOSITORY } from '@cart/domain/ports'
import { CartReadRepository } from '@cart/infrastructure/repositories/cart-read.repository'
import { CartWriteRepository } from '@cart/infrastructure/repositories/cart-write.repository'
import { DELIVERY_LINK_READ_REPOSITORY } from '@deliveries/domain/ports'
import { DeliveryLinkReadRepository } from '@deliveries/infrastructure/repositories/delivery-link-read.repository'
import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { MailService } from '@mail/application/services/mail.service'
import { getQueueToken } from '@nestjs/bullmq'
import { ConfigModule } from '@nestjs/config'
import { CommandBus } from '@nestjs/cqrs'
import { Test, type TestingModule } from '@nestjs/testing'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import { ConfirmOrderPaymentCommand } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.command'
import { ConfirmOrderPaymentHandler } from '@orders/application/commands/confirm-order-payment/confirm-order-payment.handler'
import { CreateOrderFromGalleryCommand } from '@orders/application/commands/create-order-from-gallery/create-order-from-gallery.command'
import { CreateOrderFromGalleryHandler } from '@orders/application/commands/create-order-from-gallery/create-order-from-gallery.handler'
import { SendDeliveryCommand } from '@orders/application/commands/send-delivery/send-delivery.command'
import { SendDeliveryHandler } from '@orders/application/commands/send-delivery/send-delivery.handler'
import { ORDER_READ_REPOSITORY, ORDER_WRITE_REPOSITORY } from '@orders/domain/ports'
import { PaymentMethod } from '@orders/domain/value-objects/payment-method.vo'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { OrderWriteRepository } from '@orders/infrastructure/repositories/order-write.repository'
import { PAYMENT_TRANSACTION_WRITE_REPOSITORY } from '@payments/domain/ports'
import { PaymentTransactionWriteRepository } from '@payments/infrastructure/repositories/payment-transaction-write.repository'
import { ApplyBibCorrectionCommand } from '@photos/application/commands/apply-bib-correction/apply-bib-correction.command'
import { ApplyBibCorrectionHandler } from '@photos/application/commands/apply-bib-correction/apply-bib-correction.handler'
import { ConfirmPhotoBatchCommand } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.command'
import { ConfirmPhotoBatchHandler } from '@photos/application/commands/confirm-photo-batch/confirm-photo-batch.handler'
import { DeletePhotoCommand } from '@photos/application/commands/delete-photo/delete-photo.command'
import { DeletePhotoHandler } from '@photos/application/commands/delete-photo/delete-photo.handler'
import {
  CORRECTION_REPOSITORY,
  PHOTO_BIB_WRITE_REPOSITORY,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import { CorrectionRepository } from '@photos/infrastructure/repositories/correction.repository'
import { PhotoBibWriteRepository } from '@photos/infrastructure/repositories/photo-bib-write.repository'
import { PhotoReadRepository } from '@photos/infrastructure/repositories/photo-read.repository'
import { PhotoWriteRepository } from '@photos/infrastructure/repositories/photo-write.repository'
import { PREVIEW_LINK_READ_REPOSITORY } from '@previews/domain/ports'
import { PreviewLinkReadRepository } from '@previews/infrastructure/repositories/preview-link-read.repository'
import { AuditContext, Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AUTHORIZATION_SERVICE } from '@shared/authorization/domain/ports/authorization.service.port'
import { KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import configuration from '../../../../../config/configuration'
import { validate } from '../../../../../config/env.validation'

describe('event freeze — the gallery/order boundary', () => {
  let module: TestingModule
  let prisma: PrismaService
  let createFromGallery: CreateOrderFromGalleryHandler
  let checkoutCart: CheckoutCartHandler
  let confirmPayment: ConfirmOrderPaymentHandler
  let sendDelivery: SendDeliveryHandler
  let confirmBatch: ConfirmPhotoBatchHandler
  let deletePhoto: DeletePhotoHandler
  let applyBibCorrection: ApplyBibCorrectionHandler
  let eventReadRepo: EventReadRepository

  let tenant: { id: string } | undefined
  let user: { id: string } | undefined
  let event: { id: string; slug: string } | undefined
  let photoA: { id: string } | undefined
  let photoB: { id: string } | undefined
  let bib: { id: string } | undefined
  let cart: { id: string } | undefined
  const createdOrderIds: string[] = []

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
        FreezeStateService,
        { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
        { provide: EVENT_WRITE_REPOSITORY, useClass: EventWriteRepository },
        { provide: PHOTO_READ_REPOSITORY, useClass: PhotoReadRepository },
        { provide: PHOTO_WRITE_REPOSITORY, useClass: PhotoWriteRepository },
        { provide: PHOTO_BIB_WRITE_REPOSITORY, useClass: PhotoBibWriteRepository },
        { provide: CORRECTION_REPOSITORY, useClass: CorrectionRepository },
        { provide: ORDER_READ_REPOSITORY, useClass: OrderReadRepository },
        { provide: ORDER_WRITE_REPOSITORY, useClass: OrderWriteRepository },
        { provide: CART_READ_REPOSITORY, useClass: CartReadRepository },
        { provide: CART_WRITE_REPOSITORY, useClass: CartWriteRepository },
        { provide: AUTH_USER_REPOSITORY, useClass: AuthUserRepository },
        { provide: PREVIEW_LINK_READ_REPOSITORY, useClass: PreviewLinkReadRepository },
        { provide: DELIVERY_LINK_READ_REPOSITORY, useClass: DeliveryLinkReadRepository },
        {
          provide: PAYMENT_TRANSACTION_WRITE_REPOSITORY,
          useClass: PaymentTransactionWriteRepository,
        },
        // The freeze gate is what's under test, not the permission graph.
        {
          provide: AUTHORIZATION_SERVICE,
          useValue: {
            resolveEventScope: async () => EventScope.unrestricted(),
            assert: async () => undefined,
            can: async () => true,
          },
        },
        // CloudflareModule and StorageModule are @Global(), which a narrow TestingModule does not inherit.
        {
          provide: CdnUrlBuilder,
          useValue: {
            buildPublicUrl: () => 'http://fake',
            buildWatermarkedUrl: () => 'http://fake',
            buildSecureUrl: () => 'http://fake',
            assetUrl: () => 'http://fake',
            internalUrl: () => 'http://fake',
          },
        },
        {
          provide: KV_STORAGE_ADAPTER,
          useValue: { writeBulk: async () => undefined, delete: async () => undefined },
        },
        {
          provide: STORAGE_ADAPTER,
          useValue: {
            delete: async () => undefined,
            generatePresignedGetUrl: async () => 'http://fake',
          },
        },
        { provide: getQueueToken('embedding-generation'), useValue: { addBulk: async () => [] } },
        { provide: getQueueToken('photo-classification'), useValue: { addBulk: async () => [] } },
        {
          provide: NotificationsService,
          useValue: {
            emitOrderCreated: () => undefined,
            emitOrderPaid: () => undefined,
            emitOrderDelivered: () => undefined,
          },
        },
        {
          provide: CommandBus,
          useValue: {
            execute: async () => ({
              id: crypto.randomUUID(),
              token: crypto.randomUUID(),
              deliveryUrl: 'http://fake/delivery',
              expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            }),
          },
        },
        { provide: MailService, useValue: { enqueue: async () => undefined } },
        CreateOrderFromGalleryHandler,
        CheckoutCartHandler,
        ConfirmOrderPaymentHandler,
        SendDeliveryHandler,
        ConfirmPhotoBatchHandler,
        DeletePhotoHandler,
        ApplyBibCorrectionHandler,
      ],
    }).compile()

    prisma = module.get(PrismaService)
    createFromGallery = module.get(CreateOrderFromGalleryHandler)
    checkoutCart = module.get(CheckoutCartHandler)
    confirmPayment = module.get(ConfirmOrderPaymentHandler)
    sendDelivery = module.get(SendDeliveryHandler)
    confirmBatch = module.get(ConfirmPhotoBatchHandler)
    deletePhoto = module.get(DeletePhotoHandler)
    applyBibCorrection = module.get(ApplyBibCorrectionHandler)
    eventReadRepo = module.get(EVENT_READ_REPOSITORY)

    tenant = await prisma.tenant.create({
      data: {
        name: `Freeze Tenant ${crypto.randomUUID()}`,
        is_platform: false,
        public_name: 'Freeze Public',
      },
    })
    const tenantTpl = await prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: 'tenant' },
    })
    const country = await prisma.country.findFirstOrThrow()

    user = await prisma.user.create({
      data: {
        email: `freeze-${crypto.randomUUID()}@t.com`,
        password_hash: 'x',
        first_name: 'Ana',
        last_name: 'Rider',
        permission_template_id: tenantTpl.id,
        tenant_id: tenant.id,
        customer_profile: { create: { country_id: country.id } },
      },
    })

    const eventType = await prisma.eventType.findFirstOrThrow()
    event = await prisma.event.create({
      data: {
        name: 'Frozen Vuelta',
        slug: `frozen-vuelta-${crypto.randomUUID()}`,
        start_date: new Date('2026-09-01'),
        end_date: new Date('2026-09-02'),
        event_type_id: eventType.id,
        tenant_id: tenant.id,
        status: 'active',
        is_frozen: true,
        frozen_at: new Date(),
        // existsActiveEvent / getPublicEventDetail both require a cover_image asset.
        assets: {
          create: {
            asset_type: 'cover_image',
            storage_key: `cover-${crypto.randomUUID()}`,
            public_slug: crypto.randomUUID().substring(0, 20),
          },
        },
      },
    })

    photoA = await prisma.photo.create({
      data: {
        event_id: event.id,
        filename: 'a.jpg',
        storage_key: `fa-${crypto.randomUUID()}`,
        public_slug: `fa-${crypto.randomUUID().substring(0, 8)}`,
        file_size: 100,
        status: 'processed',
      },
    })
    photoB = await prisma.photo.create({
      data: {
        event_id: event.id,
        filename: 'b.jpg',
        storage_key: `fb-${crypto.randomUUID()}`,
        public_slug: `fb-${crypto.randomUUID().substring(0, 8)}`,
        file_size: 100,
        status: 'processed',
      },
    })

    bib = await prisma.photoBib.create({
      data: { photo_id: photoA.id, source: 'ai', digits: '123' },
    })

    cart = await prisma.cart.create({
      data: {
        user_id: user.id,
        status: 'active',
        expires_at: new Date(Date.now() + 24 * 3600 * 1000),
        items: { create: { photo_id: photoB.id, event_id: event.id } },
      },
    })
  })

  afterAll(async () => {
    if (prisma) {
      const photoIds = [photoA?.id, photoB?.id].filter(Boolean) as string[]
      const txLinks = await prisma.paymentTransactionOrder
        .findMany({
          where: { order_id: { in: createdOrderIds } },
          select: { payment_transaction_id: true },
        })
        .catch(() => [])

      // Each step is independent so one failure cannot strand the rest of the fixtures.
      const steps: Array<() => Promise<unknown>> = [
        () => prisma.correction.deleteMany({ where: { photo_id: { in: photoIds } } }),
        () => prisma.deliveryLink.deleteMany({ where: { order_id: { in: createdOrderIds } } }),
        () => prisma.orderItem.deleteMany({ where: { order_id: { in: createdOrderIds } } }),
        () =>
          prisma.paymentTransactionOrder.deleteMany({
            where: { order_id: { in: createdOrderIds } },
          }),
        () =>
          prisma.paymentTransaction.deleteMany({
            where: { id: { in: txLinks.map((t) => t.payment_transaction_id) } },
          }),
        () => prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } }),
        () =>
          prisma.cart.deleteMany({
            where: { id: { in: [cart?.id].filter(Boolean) as string[] } },
          }),
        () => prisma.photo.deleteMany({ where: { id: { in: photoIds } } }),
        () =>
          prisma.event.deleteMany({
            where: { id: { in: [event?.id].filter(Boolean) as string[] } },
          }),
        () =>
          prisma.user.deleteMany({
            where: { id: { in: [user?.id].filter(Boolean) as string[] } },
          }),
        () =>
          prisma.tenant.deleteMany({
            where: { id: { in: [tenant?.id].filter(Boolean) as string[] } },
          }),
      ]
      const failures: unknown[] = []
      for (const step of steps) await step().catch((e) => failures.push(e))

      await prisma.$disconnect()
      if (failures.length > 0) throw failures[0]
    }
    if (module) await module.close()
  })

  it('keeps the public gallery and both order paths open on a frozen event', async () => {
    // biome-ignore lint/style/noNonNullAssertion: seeded in beforeAll
    const ev = event!
    // biome-ignore lint/style/noNonNullAssertion: seeded in beforeAll
    const buyer = user!

    expect(await eventReadRepo.isFrozen(ev.id)).toBe(true)

    const detail = await eventReadRepo.getPublicEventDetail(ev.slug)
    expect(detail).not.toBeNull()

    const photos = await eventReadRepo.getPublicPhotos(ev.id, new Pagination(1, 10), {
      photoCategoryId: null,
      bibNumber: null,
      bibMatch: 'exact',
      section: null,
    })
    expect(photos.items.length).toBeGreaterThan(0)

    // Path 1: gallery order — inserts unitPrice: null and prices later.
    const galleryOrder = await createFromGallery.execute(
      // biome-ignore lint/style/noNonNullAssertion: seeded in beforeAll
      new CreateOrderFromGalleryCommand(ev.id, buyer.id, [photoA!.id], '123', null),
    )
    createdOrderIds.push(galleryOrder.id)
    const galleryItems = await prisma.orderItem.findMany({ where: { order_id: galleryOrder.id } })
    expect(galleryItems).toHaveLength(1)
    expect(galleryItems[0].unit_price).toBeNull()

    // Path 2: cart checkout — snapshots unit_price at checkout.
    const checkout = await checkoutCart.execute(
      new CheckoutCartCommand(
        buyer.id,
        [{ eventId: ev.id, bibNumber: null, snapCategoryName: null }],
        PaymentMethod.TRANSFER,
      ),
    )
    expect(checkout.orders).toHaveLength(1)
    createdOrderIds.push(checkout.orders[0].orderId)
    const cartItems = await prisma.orderItem.findMany({
      where: { order_id: checkout.orders[0].orderId },
    })
    expect(cartItems).toHaveLength(1)
    expect(cartItems[0].unit_price).not.toBeNull()

    // Fulfilment still runs end to end.
    const paid = await confirmPayment.execute(
      new ConfirmOrderPaymentCommand(galleryOrder.id, new AuditContext(buyer.id)),
    )
    expect(paid.id).toBe(galleryOrder.id)

    const delivered = await sendDelivery.execute(
      new SendDeliveryCommand(galleryOrder.id, new AuditContext(buyer.id)),
    )
    expect(delivered.orderId).toBe(galleryOrder.id)
    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: galleryOrder.id } })
    expect(finalOrder.status).toBe('delivered')
  })

  it('blocks editorial mutations but leaves review corrections open on a frozen event', async () => {
    // biome-ignore lint/style/noNonNullAssertion: seeded in beforeAll
    const ev = event!
    // biome-ignore lint/style/noNonNullAssertion: seeded in beforeAll
    const actor = user!

    await expect(
      confirmBatch.execute(
        new ConfirmPhotoBatchCommand(
          ev.id,
          [
            {
              fileName: 'new.jpg',
              fileSize: 1024,
              objectKey: `events/${ev.id}/new.jpg`,
              contentType: 'image/jpeg',
            },
          ],
          new AuditContext(actor.id),
        ),
      ),
    ).rejects.toMatchObject({ messageKey: 'event.frozen_not_editable' })

    await expect(
      // biome-ignore lint/style/noNonNullAssertion: seeded in beforeAll
      deletePhoto.execute(new DeletePhotoCommand(photoB!.id, actor.id)),
    ).rejects.toMatchObject({ messageKey: 'event.frozen_not_editable' })

    // The allowed set is genuinely open, not merely undeclared.
    const corrected = await applyBibCorrection.execute(
      // biome-ignore lint/style/noNonNullAssertion: seeded in beforeAll
      new ApplyBibCorrectionCommand(photoA!.id, bib!.id, '456', actor.id),
    )
    expect(corrected.changed).toBe(true)
    expect(corrected.correctionId).toBeDefined()
  })
})
