export class MyOrderTaxDocumentProjection {
  id: string
  type: 'invoice' | 'credit_note'
  state: string
  number: string
  issueDate: string
  downloadable: boolean
  current: boolean
}
