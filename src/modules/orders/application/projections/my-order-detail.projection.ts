import { MyOrderInvoiceProjection } from './my-order-invoice.projection'
import type { MyOrderCustomerState } from './my-order-list.projection'
import { OrderBillingProjection } from './order-billing.projection'

export class MyOrderPhotoProjection {
  /** Photo UUID */
  id: string
  /** Watermarked gallery URL */
  galleryUrl: string
}

export class MyOrderDetailProjection {
  /** Order UUID */
  id: string
  /** What the customer sees, derived from the internal status */
  state: MyOrderCustomerState
  /** Event name */
  eventName: string
  /** When the order was created */
  createdAt: Date
  /** Order subtotal (Decimal serialized as string to preserve precision) */
  subtotal: string | null
  /** Currency code snapshot at time of order (e.g. USD) */
  snapCurrency: string | null
  /** True when the order's photos can be downloaded */
  canDownload: boolean
  /** True when the customer may still cancel this order */
  canCancel: boolean
  /** Photos with watermarked URLs */
  photos: MyOrderPhotoProjection[]
  /** Billing snapshot taken when the order was placed */
  billing: OrderBillingProjection | null
  /** Electronic invoice follow-up as the buyer sees it */
  invoice: MyOrderInvoiceProjection | null
}

export type RawMyOrderDetailProjection = Omit<MyOrderDetailProjection, 'invoice'>
