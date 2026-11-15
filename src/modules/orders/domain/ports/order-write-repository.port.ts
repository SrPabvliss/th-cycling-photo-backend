import type { Prisma } from '@generated/prisma/client'
import type { Order } from '../entities'
import type { OrderPayments } from '../payment-hold'

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
  /**
   * Locks the order row until `tx` ends and reads it again under that lock. It only excludes
   * anything when given the transaction that then writes the order.
   */
  findByIdForUpdate(id: string, tx: Prisma.TransactionClient): Promise<Order | null>
  /**
   * Locks the order's card payments until `tx` ends, without waiting: a payment a confirmation
   * holds is reported as `beingConfirmed` instead (Payphone may take seconds to answer). In that
   * case `tx` has failed and the caller must end it, which refusing the cancellation does.
   */
  findPaymentsForUpdate(orderId: string, tx: Prisma.TransactionClient): Promise<OrderPayments>
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
  /**
   * Under the link's lock, hands `build` the latest order on the link that is not cancelled, and
   * whether it is still alive (placed, or a card draft whose payment is under way).
   */
  lockAndUpsertPreviewOrder(
    previewLinkId: string,
    build: (
      existing: Order | null,
      tx: Prisma.TransactionClient,
      existingIsAlive: boolean,
    ) => Promise<{ order: Order; items: OrderItemInput[]; snap: OrderSnapData }>,
  ): Promise<Order>
  updateItemsDeliveredAs(orderId: string): Promise<void>
}

export const ORDER_WRITE_REPOSITORY = Symbol('ORDER_WRITE_REPOSITORY')
