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
  /** Orders in pending or payment_info_sent status */
  openCount: number
  /** Sum of subtotal across pending + payment_info_sent orders, as a Decimal string. */
  openAmount: string
  /** Orders paid or gifted with no delivery timestamp yet */
  awaitingDeliveryCount: number
  /** The seven tab counts partitioning the same in-scope, non-draft population */
  tabs: OrdersStatsTabsProjection
}

export class OrdersStatsTabsProjection {
  /** Every non-draft order in scope */
  all: number
  pending: number
  payment_info_sent: number
  paid: number
  delivered: number
  gifted: number
  cancelled: number
}
