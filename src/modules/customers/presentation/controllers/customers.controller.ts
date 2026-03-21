import { CustomerListProjection } from '@customers/application/projections'
import { GetCustomersListDto, GetCustomersListQuery } from '@customers/application/queries'
import { Controller, Get, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Pagination } from '@shared/application'
import { Roles } from '@shared/auth'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Roles('admin')
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List customers with pagination and search' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated customer list',
    type: CustomerListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetCustomersListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetCustomersListQuery(pagination, dto.search)
    return this.queryBus.execute(query)
  }
}
