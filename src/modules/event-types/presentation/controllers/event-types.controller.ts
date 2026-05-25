import { Controller, Get } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { SuccessMessage } from '@shared/http'
import { EventTypeProjection } from '../../application/projections'
import { GetAllEventTypesQuery } from '../../application/queries'

@ApiTags('event-types')
@ApiBearerAuth()
@SkipThrottle()
@Controller('event-types')
export class EventTypesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List all event types' })
  @ApiResponse({ status: 200, type: [EventTypeProjection] })
  async findAll() {
    return this.queryBus.execute(new GetAllEventTypesQuery())
  }
}
