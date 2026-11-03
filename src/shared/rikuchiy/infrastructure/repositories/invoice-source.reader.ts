import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { IInvoiceSourceReader, InvoiceSource } from '../../domain/ports'

@Injectable()
export class InvoiceSourceReader implements IInvoiceSourceReader {
  async find(orderId: string, tx: Prisma.TransactionClient): Promise<InvoiceSource | null> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        subtotal: true,
        snap_billing_id_type: true,
        snap_billing_id_number: true,
        snap_billing_legal_name: true,
        snap_billing_email: true,
        snap_billing_address: true,
        snap_invoice_consent_at: true,
        snap_invoice_consent_ip: true,
        event: { select: { name: true, start_date: true } },
        items: {
          orderBy: { photo: { filename: 'asc' } },
          select: { unit_price: true, photo: { select: { filename: true } } },
        },
      },
    })
    if (!order) return null

    const hasBilling =
      order.snap_billing_id_type !== null &&
      order.snap_billing_id_number !== null &&
      order.snap_billing_legal_name !== null &&
      order.snap_billing_email !== null

    return {
      orderId: order.id,
      status: order.status,
      subtotal: order.subtotal === null ? null : order.subtotal.toFixed(2),
      billing: hasBilling
        ? {
            idType: order.snap_billing_id_type as NonNullable<typeof order.snap_billing_id_type>,
            idNumber: order.snap_billing_id_number as string,
            legalName: order.snap_billing_legal_name as string,
            email: order.snap_billing_email as string,
            address: order.snap_billing_address,
          }
        : null,
      consent:
        order.snap_invoice_consent_at === null
          ? null
          : { givenAt: order.snap_invoice_consent_at, ip: order.snap_invoice_consent_ip },
      eventName: order.event.name,
      eventDate: order.event.start_date,
      items: order.items.map((item) => ({
        filename: item.photo.filename,
        unitPrice: item.unit_price === null ? null : item.unit_price.toFixed(2),
      })),
    }
  }
}
