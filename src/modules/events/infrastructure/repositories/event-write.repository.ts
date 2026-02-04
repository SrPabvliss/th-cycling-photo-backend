import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js'
import { Event } from '../../domain/entities/event.entity.js'
import { EventMapper } from '../mappers/event.mapper.js'

@Injectable()
export class EventWriteRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Persists an event entity (create or update). */
	async save(event: Event): Promise<Event> {
		const data = EventMapper.toPersistence(event)

		const saved = await this.prisma.event.upsert({
			where: { id: event.id },
			create: data,
			update: data,
		})

		return EventMapper.toEntity(saved)
	}

	/** Finds an event by its ID, or returns null. */
	async findById(id: string): Promise<Event | null> {
		const record = await this.prisma.event.findUnique({ where: { id } })
		return record ? EventMapper.toEntity(record) : null
	}
}
