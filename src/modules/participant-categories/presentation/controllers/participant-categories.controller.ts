import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Public } from '@shared/auth'
import { SuccessMessage } from '@shared/http'
import { GetParticipantCategoriesQuery } from '../../application/queries/get-participant-categories'

@ApiTags('participant-categories')
@Controller('participant-categories')
export class ParticipantCategoriesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Public()
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List participant categories for an event type' })
  @ApiQuery({ name: 'eventTypeId', description: 'Event type id', type: Number, required: true })
  async findAll(@Query('eventTypeId', ParseIntPipe) eventTypeId: number) {
    return this.queryBus.execute(new GetParticipantCategoriesQuery(eventTypeId))
  }
}
