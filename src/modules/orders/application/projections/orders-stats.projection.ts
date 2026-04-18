export class OrdersStatsProjection {
  /** Total number of orders */
  totalOrders: number
  /** Orders in pending status */
  pendingCount: number
  /** Orders with confirmed payment (paid + delivered) */
  paidCount: number
  /** Orders that have been delivered */
  deliveredCount: number
  /** Cancelled orders */
  cancelledCount: number
}
