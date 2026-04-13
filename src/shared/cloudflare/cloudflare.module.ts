import { Global, Module } from '@nestjs/common'
import { KV_STORAGE_ADAPTER } from './domain/ports'
import { CdnUrlBuilder, CloudflareKvAdapter } from './infrastructure'

@Global()
@Module({
  providers: [{ provide: KV_STORAGE_ADAPTER, useClass: CloudflareKvAdapter }, CdnUrlBuilder],
  exports: [KV_STORAGE_ADAPTER, CdnUrlBuilder],
})
export class CloudflareModule {}
