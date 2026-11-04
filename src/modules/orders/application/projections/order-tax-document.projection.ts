import type { SriMessage, TaxDocumentDelivery } from '@shared/rikuchiy/domain/ports'

export class OrderTaxDocumentProjection {
  id: string
  type: 'invoice' | 'credit_note'
  state: string
  number: string
  accessKey: string
  issueDate: string
  authorizedAt: Date | null
  sriMessages: SriMessage[]
  deliveries: TaxDocumentDelivery[]
  downloadable: boolean
  resendable: boolean
  current: boolean
}
