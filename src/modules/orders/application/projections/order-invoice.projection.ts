import type { OrderInvoiceStateValue } from '@shared/rikuchiy/domain/order-invoice-state'
import { OrderTaxDocumentProjection } from './order-tax-document.projection'

export class OrderInvoiceRejectionProjection {
  source: 'sri' | 'intake' | 'credit_note'
  messages: string[]
}

export class OrderInvoiceProjection {
  state: OrderInvoiceStateValue
  rejection: OrderInvoiceRejectionProjection | null
  canCorrect: boolean
  canRetryAnnulment: boolean
  documents: OrderTaxDocumentProjection[]
}
