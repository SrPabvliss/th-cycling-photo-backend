import type { Prisma } from '@generated/prisma/client'

/** Orders a buyer placed and that still stand. */
const PLACED_STATUSES = ['pending', 'payment_info_sent', 'paid', 'delivered', 'gifted'] as const

/** A card payment still under way: opened, being confirmed, or approved and not yet settled. */
const PAYMENT_UNDER_WAY = ['initiated', 'confirming', 'approved'] as const

/**
 * The orders that keep a preview link taken: placed and not cancelled, or a card draft whose
 * payment is still under way. A cancelled order, or a card draft whose payments all ended without
 * a charge, leaves the link free to be ordered from again until it expires.
 */
export function livePreviewOrderWhere(previewLinkId: string): Prisma.OrderWhereInput {
  return {
    preview_link_id: previewLinkId,
    OR: [
      { status: { in: [...PLACED_STATUSES] } },
      {
        status: 'draft',
        payment_transaction_orders: {
          some: { payment_transaction: { status: { in: [...PAYMENT_UNDER_WAY] } } },
        },
      },
    ],
  }
}
