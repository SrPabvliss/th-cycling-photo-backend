import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Pagination, PaginationQueryDto } from '@shared/application'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import { OrganizerDetailProjection } from '../../application/projections/organizer-detail.projection'
import { OrganizerEventProjection } from '../../application/projections/organizer-event.projection'
import { OrganizerCardProjection } from '../../application/projections/organizer-list.projection'
import { OrganizersStatsProjection } from '../../application/projections/organizers-stats.projection'
import { GetOrganizerDetailQuery } from '../../application/queries/get-organizer-detail/get-organizer-detail.query'
import { GetOrganizerEventsQuery } from '../../application/queries/get-organizer-events/get-organizer-events.query'
import { GetOrganizersListQuery } from '../../application/queries/get-organizers-list/get-organizers-list.query'
import { GetOrganizersStatsQuery } from '../../application/queries/get-organizers-stats/get-organizers-stats.query'
import type { OrganizerListFilters } from '../../domain/ports/organizer-read-repository.port'
import { GetOrganizersListDto } from '../dtos/get-organizers-list.dto'

@ApiTags('Organizers')
@ApiBearerAuth()
@Controller('organizers')
export class OrganizersController {
  constructor(private readonly queryBus: QueryBus) {}

  @RequirePermission('tenant.read')
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List organizers and pending invitations' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated organizers list',
    type: OrganizerCardProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetOrganizersListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(
      new GetOrganizersListQuery(pagination, toOrganizerListFilters(dto)),
    )
  }

  @RequirePermission('tenant.read')
  @Get('stats')
  @SuccessMessage('success.FETCHED', { entity: 'entities.stats' })
  @ApiOperation({ summary: 'Organizer metrics for the four tiles and the five tab counts' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Organizer stats',
    type: OrganizersStatsProjection,
  })
  async stats(@Query() dto: GetOrganizersListDto) {
    return this.queryBus.execute(new GetOrganizersStatsQuery(toOrganizerListFilters(dto)))
  }

  @RequirePermission('tenant.read')
  @Get(':id')
  @SuccessMessage('success.FETCHED', { entity: 'entities.tenant' })
  @ApiOperation({ summary: 'Organizer identity, capacity, contract history and payout methods' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Organizer detail',
    type: OrganizerDetailProjection,
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queryBus.execute(new GetOrganizerDetailQuery(id))
  }

  @RequirePermission('tenant.read')
  @Get(':id/events')
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: "Organizador's events, paginated" })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated organizer events',
    type: OrganizerEventProjection,
    isArray: true,
  })
  async events(@Param('id', ParseUUIDPipe) id: string, @Query() dto: PaginationQueryDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    return this.queryBus.execute(new GetOrganizerEventsQuery(id, pagination))
  }
}

function toOrganizerListFilters(dto: GetOrganizersListDto): OrganizerListFilters {
  return {
    search: dto.search,
    tab: dto.tab,
    sort: dto.sort,
  }
}
