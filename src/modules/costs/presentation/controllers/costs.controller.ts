import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { SuccessMessage } from '@shared/http'
import { ReadCostsQuery } from '../../application/queries/read-costs/read-costs.query'

const PASSTHROUGH = 'The data of the yupana answer, unchanged; its schema is published by yupana'

@ApiTags('Costs')
@ApiBearerAuth()
@Controller('costs')
export class CostsController {
  constructor(private readonly queryBus: QueryBus) {}

  @RequirePermission('cost.read')
  @Get('summary')
  @SuccessMessage('cost.fetched')
  @ApiOperation({ summary: 'Operating cost summary of a month, by layer and provider' })
  @ApiQuery({ name: 'month', required: false, example: '2026-11' })
  @ApiQuery({ name: 'environment', required: false, enum: ['prod', 'dev'] })
  @ApiQuery({ name: 'pricing', required: false, enum: ['list', 'effective'] })
  @ApiOkResponse({ description: PASSTHROUGH })
  async getSummary(
    @Query('month') month?: string,
    @Query('environment') environment?: string,
    @Query('pricing') pricing?: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new ReadCostsQuery('summary', { month, environment, pricing }))
  }

  @RequirePermission('cost.read')
  @Get('health')
  @SuccessMessage('cost.fetched')
  @ApiOperation({
    summary: 'Health of the cost service: statements, rejections, prices, staleness',
  })
  @ApiOkResponse({ description: PASSTHROUGH })
  async getHealth(): Promise<unknown> {
    return this.queryBus.execute(new ReadCostsQuery('health', {}))
  }

  @RequirePermission('cost.read')
  @Get('events')
  @SuccessMessage('cost.fetched')
  @ApiOperation({ summary: 'Operating cost of each event in a month' })
  @ApiQuery({ name: 'month', required: false, example: '2026-11' })
  @ApiQuery({ name: 'environment', required: false, enum: ['prod', 'dev'] })
  @ApiOkResponse({ description: PASSTHROUGH })
  async getEvents(
    @Query('month') month?: string,
    @Query('environment') environment?: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new ReadCostsQuery('events', { month, environment }))
  }

  @RequirePermission('cost.read')
  @Get('events/:eventId')
  @SuccessMessage('cost.fetched')
  @ApiOperation({ summary: 'Operating cost of one event across every month' })
  @ApiQuery({ name: 'environment', required: false, enum: ['prod', 'dev'] })
  @ApiOkResponse({ description: PASSTHROUGH })
  async getEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query('environment') environment?: string,
  ): Promise<unknown> {
    return this.queryBus.execute(new ReadCostsQuery('event', { id: eventId, environment }))
  }

  @RequirePermission('cost.read')
  @Get('photos/:photoId')
  @SuccessMessage('cost.fetched')
  @ApiOperation({ summary: 'Operating cost of one photo with the basis of each charge' })
  @ApiOkResponse({ description: PASSTHROUGH })
  async getPhoto(@Param('photoId', ParseUUIDPipe) photoId: string): Promise<unknown> {
    return this.queryBus.execute(new ReadCostsQuery('photo', { id: photoId }))
  }
}
