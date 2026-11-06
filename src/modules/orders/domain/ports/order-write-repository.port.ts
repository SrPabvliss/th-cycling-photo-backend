import type { Prisma } from '@generated/prisma/client'
import type { Order } from '../entities'

export type OrderSnapData = {
  snapFirstName: string | null
  snapLastName: string | null
  snapEmail: string
  snapPhone: string | null
  snapCountryId: number | null
  snapProvinceId: number | null
  snapCantonId: number | null
  snapCategoryName: string | null
  snapBillingAccountId: string | null
  snapBillingIdType: 'ruc' | 'national_id' | 'passport' | null
  snapBillingIdNumber: string | null
  snapBillingLegalName: string | null
  snapBillingEmail: string | null
  snapBillingAddress: string | null
  snapInvoiceConsentAt: Date | null
  snapInvoiceConsentIp: string | null
}

export type OrderItemInput = { photoId: string; unitPrice: number | null }

export interface IOrderWriteRepository {
  save(order: Order, tx?: Prisma.TransactionClient): Promise<Order>
  saveWithSnap(order: Order, snap: OrderSnapData): Promise<Order>
  savePhotos(orderId: string, items: OrderItemInput[]): Promise<void>
  replaceItems(orderId: string, items: OrderItemInput[]): Promise<void>
  lockAndUpsertDraft(
    userId: string,
    eventId: string,
    build: (
      existingDraft: Order | null,
      tx: Prisma.TransactionClient,
    ) => Promise<{ order: Order; items: OrderItemInput[]; snap: OrderSnapData }>,
  ): Promise<Order>
  lockAndUpsertPreviewOrder(
    previewLinkId: string,
    build: (
      existing: Order | null,
      tx: Prisma.TransactionClient,
    ) => Promise<{ order: Order; items: OrderItemInput[]; snap: OrderSnapData }>,
  ): Promise<Order>
  updateItemsDeliveredAs(orderId: string): Promise<void>
}

export const ORDER_WRITE_REPOSITORY = Symbol('ORDER_WRITE_REPOSITORY')
