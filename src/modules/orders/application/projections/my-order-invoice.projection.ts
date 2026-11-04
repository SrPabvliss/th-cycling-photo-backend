import type { OrderInvoiceStateValue } from '@shared/rikuchiy/domain/order-invoice-state'
import { MyOrderTaxDocumentProjection } from './my-order-tax-document.projection'

export class MyOrderInvoiceProjection {
  state: OrderInvoiceStateValue
  rejectionMessages: string[]
  canCorrect: boolean
  documents: MyOrderTaxDocumentProjection[]
}
