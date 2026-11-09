import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { ReadCostsHandler } from './application/queries/read-costs/read-costs.handler'
import { CostsController } from './presentation/controllers/costs.controller'

@Module({
  imports: [CqrsModule],
  controllers: [CostsController],
  providers: [ReadCostsHandler],
})
export class CostsModule {}
