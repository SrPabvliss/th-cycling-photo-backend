import { Controller, Get, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Pagination } from '@shared/application'
import { Roles } from '@shared/auth'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import { BuyerListProjection } from '@users/application/projections'
import { GetBuyersListDto, GetBuyersListQuery } from '@users/application/queries'

@ApiTags('Buyers')
@ApiBearerAuth()
@Roles('admin')
@Controller('buyers')
export class BuyersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List users with customer role' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated buyers list',
    type: BuyerListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetBuyersListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetBuyersListQuery(pagination, dto.search)
    return this.queryBus.execute(query)
  }
}
