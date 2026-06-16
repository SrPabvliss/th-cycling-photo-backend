export class OrdersStatsProjection {
  /** Total number of orders (includes cancelled) */
  totalOrders: number
  /** Orders shown in the default "Todos" view (excludes cancelled) */
  activeOrders: number
  /** Orders in pending status */
  pendingCount: number
  /** Orders awaiting payment after admin sent payment info */
  paymentInfoSentCount: number
  /** Orders with confirmed payment (paid + delivered) */
  paidCount: number
  /** Orders that have been delivered */
  deliveredCount: number
  /** Orders given away as a gift (terminal, excluded from revenue) */
  giftedCount: number
  /** Cancelled orders */
  cancelledCount: number
  /** Sum of subtotal across paid + delivered orders, as a Decimal string (e.g. "1234.50"). USD assumed. */
  totalRevenue: string
}
