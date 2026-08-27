import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Pagination } from '@shared/application'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { endOfDayInEcuador, startOfDayInEcuador } from '@shared/domain'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import {
  BuyerDetailProjection,
  BuyerListProjection,
  BuyersStatsProjection,
} from '@users/application/projections'
import {
  GetBuyerDetailQuery,
  GetBuyersListDto,
  GetBuyersListQuery,
  GetBuyersStatsQuery,
} from '@users/application/queries'
import type { BuyerListFilters } from '@users/domain/ports'

@ApiTags('Buyers')
@ApiBearerAuth()
@Controller('buyers')
export class BuyersController {
  constructor(private readonly queryBus: QueryBus) {}

  @RequirePermission('buyer.read')
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
    const query = new GetBuyersListQuery(pagination, toBuyerListFilters(dto))
    return this.queryBus.execute(query)
  }

  @RequirePermission('buyer.read')
  @Get('stats')
  @SuccessMessage('success.FETCHED', { entity: 'entities.stats' })
  @ApiOperation({ summary: 'Buyer metrics for the five tiles and the four purchase tabs' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Buyer stats',
    type: BuyersStatsProjection,
  })
  async stats(@Query() dto: GetBuyersListDto) {
    const query = new GetBuyersStatsQuery(toBuyerListFilters(dto))
    return this.queryBus.execute(query)
  }

  @RequirePermission('buyer.read')
  @Get(':id')
  @SuccessMessage('success.FETCHED', { entity: 'entities.buyer' })
  @ApiOperation({
    summary: 'Buyer detail: identity, contact, profile, figures, orders and consents',
  })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Buyer detail',
    type: BuyerDetailProjection,
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryBus.execute(new GetBuyerDetailQuery(id))
  }
}

function toBuyerListFilters(dto: GetBuyersListDto): BuyerListFilters {
  return {
    search: dto.search,
    purchase: dto.purchase,
    sort: dto.sort,
    countryId: dto.countryId,
    provinceId: dto.provinceId,
    registeredFrom: dto.registeredFrom ? startOfDayInEcuador(dto.registeredFrom) : undefined,
    registeredTo: dto.registeredTo ? endOfDayInEcuador(dto.registeredTo) : undefined,
    gender: dto.gender,
    ageFrom: dto.ageFrom,
    ageTo: dto.ageTo,
    emailVerified: dto.emailVerified,
    hasWhatsapp: dto.hasWhatsapp,
  }
}
