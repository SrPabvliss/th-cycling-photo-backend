import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import { ORDER_INVOICE_SYNC_QUEUE } from './domain/order-invoice-sync'
import {
  INVOICE_SOURCE_READER,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_CLIENT,
  RIKUCHIY_INVOICE_REQUESTER,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from './domain/ports'
import { RikuchiyHttpClient } from './infrastructure/adapters/rikuchiy-http.client'
import {
  RIKUCHIY_DELIVERY_QUEUE,
  RikuchiyDeliveryProcessor,
} from './infrastructure/processors/rikuchiy-delivery.processor'
import { InvoiceSourceReader } from './infrastructure/repositories/invoice-source.reader'
import { OrderTaxDocumentRepository } from './infrastructure/repositories/order-tax-document.repository'
import { RikuchiyOutboxRepository } from './infrastructure/repositories/rikuchiy-outbox.repository'
import { OrderInvoiceStateRefresher } from './infrastructure/services/order-invoice-state-refresher.service'
import { RikuchiyDeliverySchedulerService } from './infrastructure/services/rikuchiy-delivery-scheduler.service'
import { RikuchiyInvoiceRequesterService } from './infrastructure/services/rikuchiy-invoice-requester.service'

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: RIKUCHIY_DELIVERY_QUEUE }),
    BullModule.registerQueue({ name: ORDER_INVOICE_SYNC_QUEUE }),
  ],
  providers: [
    { provide: RIKUCHIY_CLIENT, useClass: RikuchiyHttpClient },
    { provide: RIKUCHIY_OUTBOX_REPOSITORY, useClass: RikuchiyOutboxRepository },
    { provide: ORDER_TAX_DOCUMENT_REPOSITORY, useClass: OrderTaxDocumentRepository },
    { provide: INVOICE_SOURCE_READER, useClass: InvoiceSourceReader },
    { provide: RIKUCHIY_INVOICE_REQUESTER, useClass: RikuchiyInvoiceRequesterService },
    OrderInvoiceStateRefresher,
    RikuchiyDeliveryProcessor,
    RikuchiyDeliverySchedulerService,
  ],
  exports: [
    RIKUCHIY_CLIENT,
    RIKUCHIY_OUTBOX_REPOSITORY,
    RIKUCHIY_INVOICE_REQUESTER,
    ORDER_TAX_DOCUMENT_REPOSITORY,
    OrderInvoiceStateRefresher,
  ],
})
export class RikuchiyModule {}
