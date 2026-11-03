export type SriIdType = '04' | '05' | '06'

export type InvoiceIdType = 'ruc' | 'national_id' | 'passport'

export const SRI_ID_TYPE: Record<InvoiceIdType, SriIdType> = {
  ruc: '04',
  national_id: '05',
  passport: '06',
}

export interface RikuchiyNamedValue {
  name: string
  value: string
}

export interface RikuchiyEmissionLine {
  code: string
  description: string
  quantity: 1
  grossPrice: string
  additionalDetails: RikuchiyNamedValue[]
}

export interface RikuchiyEmissionPayload {
  emissionId: string
  sale: { app: string; externalRef: string }
  buyer: {
    idType: SriIdType
    idNumber: string
    legalName: string
    address: string | null
    email: string
    phone: null
  }
  lines: RikuchiyEmissionLine[]
  additionalInfo: RikuchiyNamedValue[]
  total: string
  paymentMethod: '20'
  consent: { givenAt: string; ip: string }
}
