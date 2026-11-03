import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import {
  INVOICE_SOURCE_READER,
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
import { RikuchiyOutboxRepository } from './infrastructure/repositories/rikuchiy-outbox.repository'
import { RikuchiyDeliverySchedulerService } from './infrastructure/services/rikuchiy-delivery-scheduler.service'
import { RikuchiyInvoiceRequesterService } from './infrastructure/services/rikuchiy-invoice-requester.service'

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: RIKUCHIY_DELIVERY_QUEUE })],
  providers: [
    { provide: RIKUCHIY_CLIENT, useClass: RikuchiyHttpClient },
    { provide: RIKUCHIY_OUTBOX_REPOSITORY, useClass: RikuchiyOutboxRepository },
    { provide: INVOICE_SOURCE_READER, useClass: InvoiceSourceReader },
    { provide: RIKUCHIY_INVOICE_REQUESTER, useClass: RikuchiyInvoiceRequesterService },
    RikuchiyDeliveryProcessor,
    RikuchiyDeliverySchedulerService,
  ],
  exports: [RIKUCHIY_CLIENT, RIKUCHIY_OUTBOX_REPOSITORY, RIKUCHIY_INVOICE_REQUESTER],
})
export class RikuchiyModule {}
