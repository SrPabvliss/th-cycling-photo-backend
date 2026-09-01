import { Module } from '@nestjs/common'
import { StorageModule } from '@shared/storage/storage.module'
import { WatermarkNormalizer } from './infrastructure/watermark-normalizer.service'

@Module({
  imports: [StorageModule],
  providers: [WatermarkNormalizer],
  exports: [WatermarkNormalizer],
})
export class ImagesModule {}
