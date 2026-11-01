import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import { YUPANA_CLIENT, YUPANA_OUTBOX_REPOSITORY, YUPANA_PHOTO_DECLARER } from './domain/ports'
import { YupanaHttpClient } from './infrastructure/adapters/yupana-http.client'
import {
  YUPANA_DELIVERY_QUEUE,
  YupanaDeliveryProcessor,
} from './infrastructure/processors/yupana-delivery.processor'
import { YupanaOutboxRepository } from './infrastructure/repositories/yupana-outbox.repository'
import { YupanaDeliverySchedulerService } from './infrastructure/services/yupana-delivery-scheduler.service'
import { YupanaPhotoDeclarerService } from './infrastructure/services/yupana-photo-declarer.service'

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: YUPANA_DELIVERY_QUEUE })],
  providers: [
    { provide: YUPANA_OUTBOX_REPOSITORY, useClass: YupanaOutboxRepository },
    { provide: YUPANA_CLIENT, useClass: YupanaHttpClient },
    { provide: YUPANA_PHOTO_DECLARER, useClass: YupanaPhotoDeclarerService },
    YupanaDeliveryProcessor,
    YupanaDeliverySchedulerService,
  ],
  exports: [YUPANA_OUTBOX_REPOSITORY, YUPANA_CLIENT, YUPANA_PHOTO_DECLARER],
})
export class YupanaModule {}
