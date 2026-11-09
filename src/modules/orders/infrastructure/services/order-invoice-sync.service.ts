import { MailService } from '@mail/application/services/mail.service'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '@shared/infrastructure'
import type { InvoiceStateView } from '@shared/rikuchiy/domain/order-invoice-state'
import {
  type CachedTaxDocument,
  type IOrderTaxDocumentRepository,
  type IRikuchiyClient,
  type IRikuchiyOutboxRepository,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_CLIENT,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '@shared/rikuchiy/domain/ports'
import { OrderInvoiceStateRefresher } from '@shared/rikuchiy/infrastructure/services/order-invoice-state-refresher.service'

@Injectable()
export class OrderInvoiceSyncService {
  private readonly logger = new Logger(OrderInvoiceSyncService.name)

  constructor(
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
    @Inject(ORDER_TAX_DOCUMENT_REPOSITORY)
    private readonly orderTaxDocumentRepository: IOrderTaxDocumentRepository,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
    private readonly orderInvoiceStateRefresher: OrderInvoiceStateRefresher,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async syncOrder(orderId: string): Promise<InvoiceStateView | null> {
    const startedAt = new Date()
    const rows = await this.rikuchiyOutboxRepository.findByOrder(orderId)
    const externalRefs = [
      ...new Set(rows.filter((row) => row.status === 'sent').map((row) => row.externalRef)),
    ]

    const documents: CachedTaxDocument[] = []
    for (const externalRef of externalRefs) {
      const saleDocuments = await this.rikuchiyClient.getSaleDocuments(externalRef)
      if (saleDocuments === null) return null
      documents.push(...saleDocuments)
    }

    const view = await this.prisma.$transaction(async (tx) => {
      await this.orderTaxDocumentRepository.upsertMany(orderId, documents, startedAt, tx)
      const refreshed = await this.orderInvoiceStateRefresher.refresh(orderId, tx)
      await tx.order.update({ where: { id: orderId }, data: { invoice_synced_at: startedAt } })
      return refreshed
    })

    await this.notifyRejection(orderId, view)
    return view
  }

  async notifyRejection(orderId: string, view: InvoiceStateView): Promise<void> {
    if (view.state !== 'rejected') {
      await this.prisma.order.updateMany({
        where: { id: orderId, invoice_rejection_notified_at: { not: null } },
        data: { invoice_rejection_notified_at: null },
      })
      return
    }
    if (view.rejection?.source !== 'sri') return

    const claimed = await this.prisma.order.updateMany({
      where: { id: orderId, invoice_rejection_notified_at: null },
      data: { invoice_rejection_notified_at: new Date() },
    })
    if (claimed.count === 0) return

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        user: { select: { email: true, first_name: true } },
        event: { select: { name: true } },
      },
    })
    const webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')

    try {
      await this.mailService.enqueue({
        to: order.user.email,
        subject: 'Necesitamos corregir los datos de tu factura',
        template: 'invoice-rejected',
        vars: {
          firstName: order.user.first_name ?? '',
          eventName: order.event.name,
          orderRef: order.id.slice(0, 8),
          reason: view.rejection.messages.join('. '),
          correctUrl: `${webBaseUrl}/account/orders/${order.id}`,
          logoUrl: `${webBaseUrl}/brand/logo-email.png`,
        },
      })
    } catch (error) {
      this.logger.error(
        `Could not enqueue the invoice rejection email. orderId=${orderId} reason=${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
