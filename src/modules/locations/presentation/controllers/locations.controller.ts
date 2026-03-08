import { CantonProjection, ProvinceProjection } from '@locations/application/projections'
import { GetCantonsByProvinceQuery, GetProvincesQuery } from '@locations/application/queries'
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly queryBus: QueryBus) {}

  /** Lists all Ecuador provinces sorted alphabetically. */
  @Get('provinces')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List all provinces' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'All provinces sorted alphabetically',
    type: ProvinceProjection,
    isArray: true,
  })
  async findAllProvinces() {
    return this.queryBus.execute(new GetProvincesQuery())
  }

  /** Lists cantons for a given province sorted alphabetically. */
  @Get('provinces/:provinceId/cantons')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List cantons by province' })
  @ApiParam({ name: 'provinceId', description: 'Province ID', type: Number })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Cantons for the province sorted alphabetically',
    type: CantonProjection,
    isArray: true,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Province not found' })
  async findCantonsByProvince(@Param('provinceId', ParseIntPipe) provinceId: number) {
    return this.queryBus.execute(new GetCantonsByProvinceQuery(provinceId))
  }
}
