import {
  CantonProjection,
  CountryProjection,
  ProvinceProjection,
} from '@locations/application/projections'
import {
  GetCantonsByProvinceQuery,
  GetCountriesQuery,
  GetProvincesByCountryQuery,
  GetProvincesQuery,
} from '@locations/application/queries'
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Public } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Locations')
@Controller()
export class LocationsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Public()
  @Get('countries')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List all countries alphabetically' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'All countries sorted alphabetically',
    type: CountryProjection,
    isArray: true,
  })
  async findAllCountries() {
    return this.queryBus.execute(new GetCountriesQuery())
  }

  @Public()
  @Get('countries/:countryId/provinces')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List provinces for a country' })
  @ApiParam({ name: 'countryId', description: 'Country ID', type: Number })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Provinces for the country sorted alphabetically',
    type: ProvinceProjection,
    isArray: true,
  })
  async findProvincesByCountry(@Param('countryId', ParseIntPipe) countryId: number) {
    return this.queryBus.execute(new GetProvincesByCountryQuery(countryId))
  }

  @Public()
  @Get('locations/provinces')
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

  @Public()
  @Get('locations/provinces/:provinceId/cantons')
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
