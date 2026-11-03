import type { Prisma } from '@generated/prisma/client'
import type { InvoiceIdType } from '../rikuchiy-emission-payload'

export interface InvoiceSource {
  orderId: string
  status: string
  subtotal: string | null
  billing: {
    idType: InvoiceIdType
    idNumber: string
    legalName: string
    email: string
    address: string | null
  } | null
  consent: { givenAt: Date; ip: string | null } | null
  eventName: string
  eventDate: Date
  items: { filename: string; unitPrice: string | null }[]
}

export interface IInvoiceSourceReader {
  find(orderId: string, tx: Prisma.TransactionClient): Promise<InvoiceSource | null>
}

export const INVOICE_SOURCE_READER = Symbol('INVOICE_SOURCE_READER')
