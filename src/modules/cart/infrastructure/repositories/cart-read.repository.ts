import type {
  ActiveCartProjection,
  CartItemsByEventProjection,
  CartSummaryProjection,
  CartViewProjection,
} from '@cart/application/projections'
import type { ICartReadRepository } from '@cart/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class CartReadRepository implements ICartReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByUserId(userId: string): Promise<ActiveCartProjection | null> {
    const cart = await this.prisma.cart.findFirst({
      where: { user_id: userId, status: 'active' },
      select: { id: true, user_id: true, session_id: true },
    })
    if (!cart) return null
    return { id: cart.id, userId: cart.user_id, sessionId: cart.session_id }
  }

  async findActiveBySessionId(sessionId: string): Promise<ActiveCartProjection | null> {
    const cart = await this.prisma.cart.findFirst({
      where: { session_id: sessionId, status: 'active' },
      select: { id: true, user_id: true, session_id: true },
    })
    if (!cart) return null
    return { id: cart.id, userId: cart.user_id, sessionId: cart.session_id }
  }

  async getCartView(cartId: string): Promise<CartViewProjection> {
    const items = await this.prisma.cartItem.findMany({
      where: { cart_id: cartId, removed_at: null },
      select: {
        photo: { select: { id: true, public_slug: true } },
        event: { select: { id: true, name: true, event_date: true } },
      },
      orderBy: { added_at: 'asc' },
    })

    const eventMap = new Map<
      string,
      {
        eventId: string
        eventName: string
        eventDate: Date
        photos: { id: string; publicSlug: string }[]
      }
    >()

    for (const item of items) {
      const eventId = item.event.id
      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          eventId,
          eventName: item.event.name,
          eventDate: item.event.event_date,
          photos: [],
        })
      }
      eventMap.get(eventId)?.photos.push({
        id: item.photo.id,
        publicSlug: item.photo.public_slug,
      })
    }

    return Array.from(eventMap.values())
  }

  async getCartItemsByEvent(cartId: string): Promise<CartItemsByEventProjection[]> {
    const items = await this.prisma.cartItem.findMany({
      where: { cart_id: cartId, removed_at: null },
      select: { photo_id: true, event: { select: { id: true, name: true, event_type_id: true } } },
    })

    const eventMap = new Map<
      string,
      { eventId: string; eventName: string; eventTypeId: number; photoIds: string[] }
    >()
    for (const item of items) {
      const eventId = item.event.id
      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, {
          eventId,
          eventName: item.event.name,
          eventTypeId: item.event.event_type_id,
          photoIds: [],
        })
      }
      eventMap.get(eventId)?.photoIds.push(item.photo_id)
    }

    return Array.from(eventMap.values())
  }

  async getCartSummary(cartId: string): Promise<CartSummaryProjection> {
    const items = await this.prisma.cartItem.findMany({
      where: { cart_id: cartId, removed_at: null },
      select: { event_id: true },
    })
    return { itemCount: items.length, eventCount: new Set(items.map((i) => i.event_id)).size }
  }
}
