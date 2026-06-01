import { Controller, Get, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiTags } from '@nestjs/swagger'
import { GetPricingPreviewDto } from '@pricing/application/queries/get-pricing-preview/get-pricing-preview.dto'
import { GetPricingPreviewQuery } from '@pricing/application/queries/get-pricing-preview/get-pricing-preview.query'
import { GetPricingTiersQuery } from '@pricing/application/queries/get-pricing-tiers/get-pricing-tiers.query'
import { Public } from '@shared/auth'

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly queryBus: QueryBus) {}

  @Public()
  @Get('preview')
  preview(@Query() dto: GetPricingPreviewDto) {
    return this.queryBus.execute(new GetPricingPreviewQuery(dto.photoCount))
  }

  @Public()
  @Get('tiers')
  tiers() {
    return this.queryBus.execute(new GetPricingTiersQuery())
  }
}
