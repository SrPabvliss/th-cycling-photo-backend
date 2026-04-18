import { Global, Module } from '@nestjs/common'
import { STORAGE_ADAPTER } from './domain/ports'
import { BackblazeB2Adapter } from './infrastructure/adapters'

@Global()
@Module({
  providers: [{ provide: STORAGE_ADAPTER, useClass: BackblazeB2Adapter }],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
