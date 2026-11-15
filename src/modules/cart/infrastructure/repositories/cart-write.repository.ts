import type { CartSummaryProjection } from '@cart/application/projections'
import type { ICartWriteRepository } from '@cart/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class CartWriteRepository implements ICartWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCart(data: {
    userId?: string
    sessionId?: string
    expiresAt: Date
  }): Promise<string> {
    const cart = await this.prisma.cart.create({
      data: {
        user_id: data.userId ?? null,
        session_id: data.sessionId ?? null,
        expires_at: data.expiresAt,
      },
      select: { id: true },
    })
    return cart.id
  }

  async addItem(cartId: string, photoId: string, eventId: string): Promise<CartSummaryProjection> {
    await this.prisma.cartItem.upsert({
      where: { cart_id_photo_id: { cart_id: cartId, photo_id: photoId } },
      create: { cart_id: cartId, photo_id: photoId, event_id: eventId },
      update: { removed_at: null, added_at: new Date() },
    })
    return this.getSummary(cartId)
  }

  async removeItem(cartId: string, photoId: string): Promise<CartSummaryProjection> {
    await this.prisma.cartItem.updateMany({
      where: { cart_id: cartId, photo_id: photoId, removed_at: null },
      data: { removed_at: new Date() },
    })
    return this.getSummary(cartId)
  }

  async removeItems(cartId: string, photoIds: string[]): Promise<void> {
    if (photoIds.length === 0) return

    await this.prisma.cartItem.updateMany({
      where: { cart_id: cartId, photo_id: { in: photoIds }, removed_at: null },
      data: { removed_at: new Date() },
    })
  }

  async mergeAnonymousToUser(sessionCartId: string, userCartId: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const sessionItems = await tx.cartItem.findMany({
        where: { cart_id: sessionCartId, removed_at: null },
        select: { photo_id: true, event_id: true },
      })

      if (sessionItems.length === 0) {
        await tx.cart.update({
          where: { id: sessionCartId },
          data: { status: 'converted', converted_at: new Date() },
        })
        return 0
      }

      // Every row the account cart ever had for these photos, removed ones included: a photo the
      // buyer took out and then added again without a session is wanted again, so its row comes
      // back, exactly as `addItem` brings it back for a signed-in buyer.
      const accountRows = await tx.cartItem.findMany({
        where: { cart_id: userCartId, photo_id: { in: sessionItems.map((i) => i.photo_id) } },
        select: { photo_id: true, removed_at: true },
      })
      const removedAt = new Map(accountRows.map((row) => [row.photo_id, row.removed_at]))

      const revived = sessionItems.filter(
        (i) => removedAt.has(i.photo_id) && removedAt.get(i.photo_id) !== null,
      )
      const created = sessionItems.filter((i) => !removedAt.has(i.photo_id))

      if (revived.length > 0) {
        await tx.cartItem.updateMany({
          where: { cart_id: userCartId, photo_id: { in: revived.map((i) => i.photo_id) } },
          data: { removed_at: null, added_at: new Date() },
        })
      }
      if (created.length > 0) {
        await tx.cartItem.createMany({
          data: created.map((i) => ({
            cart_id: userCartId,
            photo_id: i.photo_id,
            event_id: i.event_id,
          })),
          skipDuplicates: true,
        })
      }

      await tx.cart.update({
        where: { id: sessionCartId },
        data: { status: 'converted', converted_at: new Date() },
      })

      return revived.length + created.length
    })
  }

  async transferCartToUser(cartId: string, userId: string): Promise<void> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { user_id: userId, session_id: null },
    })
  }

  async markConverted(cartId: string): Promise<void> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { status: 'converted', converted_at: new Date() },
    })
  }

  private async getSummary(cartId: string): Promise<CartSummaryProjection> {
    const items = await this.prisma.cartItem.findMany({
      where: { cart_id: cartId, removed_at: null },
      select: { event_id: true },
    })
    return { itemCount: items.length, eventCount: new Set(items.map((i) => i.event_id)).size }
  }
}
