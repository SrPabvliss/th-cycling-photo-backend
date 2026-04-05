import type { CartSummaryProjection } from '@cart/application/projections'
import {
  CART_READ_REPOSITORY,
  CART_WRITE_REPOSITORY,
  type ICartReadRepository,
  type ICartWriteRepository,
} from '@cart/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { AddToCartCommand } from './add-to-cart.command'

const CART_EXPIRY_DAYS = 30

@CommandHandler(AddToCartCommand)
export class AddToCartHandler implements ICommandHandler<AddToCartCommand> {
  constructor(
    @Inject(CART_READ_REPOSITORY) private readonly cartReadRepo: ICartReadRepository,
    @Inject(CART_WRITE_REPOSITORY) private readonly cartWriteRepo: ICartWriteRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
  ) {}

  async execute(command: AddToCartCommand): Promise<CartSummaryProjection> {
    // 1. Validate the photo exists and get its event_id
    const photo = await this.photoReadRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('entities.photo', command.photoId)

    const eventId = photo.eventId

    // 2. Find or create active cart
    let cart = command.userId
      ? await this.cartReadRepo.findActiveByUserId(command.userId)
      : command.sessionId
        ? await this.cartReadRepo.findActiveBySessionId(command.sessionId)
        : null

    if (!cart) {
      if (!command.userId && !command.sessionId) {
        throw AppException.businessRule('cart.no_active_cart')
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + CART_EXPIRY_DAYS)

      const cartId = await this.cartWriteRepo.createCart({
        userId: command.userId ?? undefined,
        sessionId: command.sessionId ?? undefined,
        expiresAt,
      })

      cart = {
        id: cartId,
        userId: command.userId,
        sessionId: command.sessionId,
      }
    }

    // 3. Add item to cart
    return this.cartWriteRepo.addItem(cart.id, command.photoId, eventId)
  }
}
