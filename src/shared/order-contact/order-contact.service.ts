import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'

/** Who is changing the phone: the organizer panel correcting it, or the buyer's own account. */
export type OrderContactChangeSource = 'admin' | 'customer'

export interface OrderContactChangeAuthor {
  changedById: string
  source: OrderContactChangeSource
}

/**
 * Orders still being worked on: someone will write to the buyer about them. A delivered or a
 * cancelled order is finished, and keeps the phone it was handled with.
 */
function inProgressOf(userId: string): Prisma.OrderWhereInput {
  return {
    user_id: userId,
    OR: [
      { status: { in: ['draft', 'pending', 'payment_info_sent', 'paid'] } },
      { status: 'gifted', delivered_at: null },
    ],
  }
}

/**
 * The phone frozen on an order (`snap_phone`) is how the organizer reaches the buyer, and it went
 * stale the moment the buyer fixed a mistyped number in their account: the order kept the wrong
 * one and the message went nowhere. This keeps the two together while an order is in progress, and
 * writes down who changed what.
 *
 * It lives outside the orders and the users modules because both write through it.
 */
@Injectable()
export class OrderContactService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The buyer's number changed: every order of theirs still in progress takes it. Answers how many
   * orders changed.
   */
  async syncOrdersInProgress(
    userId: string,
    phone: string,
    author: OrderContactChangeAuthor,
  ): Promise<number> {
    return this.prisma.$transaction((tx) => this.rewrite(tx, inProgressOf(userId), phone, author))
  }

  /**
   * A correction made on one order: that order takes the phone whatever its state, and so do the
   * buyer's other orders in progress, which carry the same mistake. Answers how many changed.
   */
  async correctFromOrder(
    tx: Prisma.TransactionClient,
    order: { id: string; userId: string },
    phone: string,
    author: OrderContactChangeAuthor,
  ): Promise<number> {
    return this.rewrite(tx, { OR: [{ id: order.id }, inProgressOf(order.userId)] }, phone, author)
  }

  /**
   * Makes `phone` the primary number of the account, marked as WhatsApp. A number the account
   * already has is promoted; otherwise the primary one is overwritten, since it was the wrong one.
   */
  async setAccountPrimaryPhone(
    tx: Prisma.TransactionClient,
    userId: string,
    phone: string,
  ): Promise<void> {
    const [existing, primary] = await Promise.all([
      tx.userPhone.findFirst({ where: { user_id: userId, phone_number: phone } }),
      tx.userPhone.findFirst({ where: { user_id: userId, is_primary: true } }),
    ])

    if (existing) {
      if (existing.is_primary) return
      // One primary per account (unique partial index): the old one steps down first.
      await tx.userPhone.updateMany({
        where: { user_id: userId, is_primary: true },
        data: { is_primary: false },
      })
      await tx.userPhone.update({
        where: { id: existing.id },
        data: { is_primary: true, is_whatsapp: true },
      })
      return
    }

    if (primary) {
      await tx.userPhone.update({
        where: { id: primary.id },
        data: { phone_number: phone, is_whatsapp: true },
      })
      return
    }

    await tx.userPhone.create({
      data: { user_id: userId, phone_number: phone, is_whatsapp: true, is_primary: true },
    })
  }

  private async rewrite(
    tx: Prisma.TransactionClient,
    where: Prisma.OrderWhereInput,
    phone: string,
    author: OrderContactChangeAuthor,
  ): Promise<number> {
    const stale = await tx.order.findMany({
      where: { AND: [where, { OR: [{ snap_phone: null }, { snap_phone: { not: phone } }] }] },
      select: { id: true, snap_phone: true },
    })
    if (stale.length === 0) return 0

    await tx.order.updateMany({
      where: { id: { in: stale.map((order) => order.id) } },
      data: { snap_phone: phone },
    })
    await tx.orderContactChange.createMany({
      data: stale.map((order) => ({
        order_id: order.id,
        old_phone: order.snap_phone,
        new_phone: phone,
        source: author.source,
        changed_by_id: author.changedById,
      })),
    })
    return stale.length
  }
}
