import type { Prisma } from '@generated/prisma/client'

export interface IInvoiceRequester {
  request(orderId: string, tx: Prisma.TransactionClient): Promise<void>
  withdraw(orderId: string, tx: Prisma.TransactionClient): Promise<void>
}

export const RIKUCHIY_INVOICE_REQUESTER = Symbol('RIKUCHIY_INVOICE_REQUESTER')
