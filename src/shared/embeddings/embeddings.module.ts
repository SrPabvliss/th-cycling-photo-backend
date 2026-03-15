import { Global, Module } from '@nestjs/common'
import { EMBEDDING_ADAPTER } from './domain/ports'
import { VoyageAIEmbeddingAdapter } from './infrastructure/adapters'

@Global()
@Module({
  providers: [{ provide: EMBEDDING_ADAPTER, useClass: VoyageAIEmbeddingAdapter }],
  exports: [EMBEDDING_ADAPTER],
})
export class EmbeddingsModule {}
