import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import type { CommandBus, QueryBus } from '@nestjs/cqrs'
import { SuccessMessage } from '../../../../shared/http/decorators/success-message.decorator.js'
import { CreateEventCommand } from '../../application/commands/create-event/create-event.command.js'
import type { CreateEventDto } from '../../application/commands/create-event/create-event.dto.js'
import type { GetEventsListDto } from '../../application/queries/get-events-list/get-events-list.dto.js'
import { GetEventsListQuery } from '../../application/queries/get-events-list/get-events-list.query.js'

@Controller('events')
export class EventsController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@Post()
	@SuccessMessage('success.CREATED')
	async create(@Body() dto: CreateEventDto) {
		const command = new CreateEventCommand(dto.name, dto.date, dto.location ?? null)
		return this.commandBus.execute(command)
	}

	@Get()
	@SuccessMessage('success.LIST')
	async findAll(@Query() dto: GetEventsListDto) {
		const query = new GetEventsListQuery(dto.page ?? 1, dto.limit ?? 20)
		return this.queryBus.execute(query)
	}
}
