import type { Prisma } from '@generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { type InvoiceStateView, OrderInvoiceState } from '../../domain/order-invoice-state'
import {
  type IOrderTaxDocumentRepository,
  type IRikuchiyOutboxRepository,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '../../domain/ports'

@Injectable()
export class OrderInvoiceStateRefresher {
  constructor(
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    @Inject(ORDER_TAX_DOCUMENT_REPOSITORY)
    private readonly orderTaxDocumentRepository: IOrderTaxDocumentRepository,
    private readonly prisma: PrismaService,
  ) {}

  async refresh(orderId: string, tx?: Prisma.TransactionClient): Promise<InvoiceStateView> {
    return this.write(orderId, {}, tx)
  }

  async settle(orderId: string, tx?: Prisma.TransactionClient): Promise<InvoiceStateView> {
    return this.write(orderId, { invoice_synced_at: null }, tx)
  }

  private async write(
    orderId: string,
    extra: Prisma.OrderUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InvoiceStateView> {
    const rows = await this.rikuchiyOutboxRepository.findByOrder(orderId, tx)
    const documents = await this.orderTaxDocumentRepository.findByOrder(orderId, tx)
    const view = OrderInvoiceState.derive(rows, documents)
    await (tx ?? this.prisma).order.update({
      where: { id: orderId },
      data: { ...extra, invoice_state: view.state },
    })
    return view
  }
}
