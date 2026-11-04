import type { Prisma } from '@generated/prisma/client'
import type { AnnulmentReason } from '../rikuchiy-annulment'

export interface IInvoiceRequester {
  request(orderId: string, tx: Prisma.TransactionClient): Promise<void>
  correct(orderId: string, tx: Prisma.TransactionClient): Promise<boolean>
  retryAnnulment(orderId: string, tx: Prisma.TransactionClient): Promise<boolean>
  withdraw(orderId: string, reason: AnnulmentReason, tx: Prisma.TransactionClient): Promise<void>
}

export const RIKUCHIY_INVOICE_REQUESTER = Symbol('RIKUCHIY_INVOICE_REQUESTER')
