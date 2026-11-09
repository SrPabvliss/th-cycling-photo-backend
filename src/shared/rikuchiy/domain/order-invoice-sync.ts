export const ORDER_INVOICE_SYNC_QUEUE = 'order-invoice-sync'
export const SYNC_ORDER_JOB = 'sync-order'
export const SYNC_FOLLOW_UP_DELAYS_MS = [15_000, 60_000]

export interface SyncOrderJobData {
  orderId: string
}
