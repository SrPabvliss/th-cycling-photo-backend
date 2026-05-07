import { Global, Module } from '@nestjs/common'
import { CLASSIFICATION_PIPELINE_ADAPTER } from './domain/ports'
import { CyclingAiPipelineAdapter } from './infrastructure/adapters'

@Global()
@Module({
  providers: [{ provide: CLASSIFICATION_PIPELINE_ADAPTER, useClass: CyclingAiPipelineAdapter }],
  exports: [CLASSIFICATION_PIPELINE_ADAPTER],
})
export class AiPipelineModule {}
