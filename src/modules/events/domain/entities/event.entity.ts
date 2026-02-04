import { AppException } from '../../../../shared/domain/exceptions/app.exception.js'
import { EventStatus, type EventStatusType } from '../value-objects/event-status.vo.js'

export class Event {
	constructor(
		public readonly id: string,
		public name: string,
		public date: Date,
		public location: string | null,
		public status: EventStatusType,
		public totalPhotos: number,
		public processedPhotos: number,
		public readonly createdAt: Date,
		public updatedAt: Date,
	) {}

	/**
	 * Factory method for creating a new event.
	 * Applies all business validations before instantiation.
	 */
	static create(data: { name: string; date: Date; location: string | null }): Event {
		if (data.name.length < 3 || data.name.length > 200) {
			throw AppException.businessRule('event.name_invalid_length')
		}

		const today = new Date()
		today.setHours(0, 0, 0, 0)
		if (data.date < today) {
			throw AppException.businessRule('event.date_in_past')
		}

		return new Event(
			crypto.randomUUID(),
			data.name,
			data.date,
			data.location,
			EventStatus.DRAFT,
			0,
			0,
			new Date(),
			new Date(),
		)
	}

	/**
	 * Reconstitutes an entity from persistence data.
	 * No validations are applied – the data is trusted.
	 */
	static fromPersistence(data: {
		id: string
		name: string
		date: Date
		location: string | null
		status: EventStatusType
		totalPhotos: number
		processedPhotos: number
		createdAt: Date
		updatedAt: Date
	}): Event {
		return new Event(
			data.id,
			data.name,
			data.date,
			data.location,
			data.status,
			data.totalPhotos,
			data.processedPhotos,
			data.createdAt,
			data.updatedAt,
		)
	}
}
