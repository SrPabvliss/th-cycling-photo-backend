import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { PrismaModule } from '@shared/infrastructure'
import { ClearEventPricingConfigHandler } from './application/commands/clear-event-pricing-config/clear-event-pricing-config.handler'
import { SetEventPricingConfigHandler } from './application/commands/set-event-pricing-config/set-event-pricing-config.handler'
import { GetPricingPreviewHandler } from './application/queries/get-pricing-preview/get-pricing-preview.handler'
import { GetPricingTiersHandler } from './application/queries/get-pricing-tiers/get-pricing-tiers.handler'
import { EventPricingResolver } from './application/services/event-pricing-resolver.service'
import { EVENT_PRICING_READ_REPOSITORY, EVENT_PRICING_WRITE_REPOSITORY } from './domain/ports'
import { EventPricingReadRepository } from './infrastructure/repositories/event-pricing-read.repository'
import { EventPricingWriteRepository } from './infrastructure/repositories/event-pricing-write.repository'
import { PricingController } from './presentation/controllers/pricing.controller'
import { PricingAdminController } from './presentation/controllers/pricing-admin.controller'

@Module({
  imports: [CqrsModule, PrismaModule],
  controllers: [PricingController, PricingAdminController],
  providers: [
    EventPricingResolver,
    GetPricingPreviewHandler,
    GetPricingTiersHandler,
    SetEventPricingConfigHandler,
    ClearEventPricingConfigHandler,
    { provide: EVENT_PRICING_READ_REPOSITORY, useClass: EventPricingReadRepository },
    { provide: EVENT_PRICING_WRITE_REPOSITORY, useClass: EventPricingWriteRepository },
  ],
  exports: [EventPricingResolver],
})
export class PricingModule {}
