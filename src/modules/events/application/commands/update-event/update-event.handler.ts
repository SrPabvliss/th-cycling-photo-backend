import {
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'
import { LocationValidator } from '@locations/application/services'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { UpdateEventCommand } from './update-event.command'

@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    private readonly locationValidator: LocationValidator,
  ) {}

  /** Loads an event, applies updates, and persists it. */
  async execute(command: UpdateEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.id)
    if (!event) throw AppException.notFound('Event', command.id)

    const provinceId = command.provinceId !== undefined ? command.provinceId : event.provinceId
    const cantonId = command.cantonId !== undefined ? command.cantonId : event.cantonId

    await this.locationValidator.validate(provinceId, cantonId)

    event.update({
      name: command.name,
      description: command.description,
      date: command.date,
      provinceId: command.provinceId,
      cantonId: command.cantonId,
      eventTypeId: command.eventTypeId,
    })

    if (command.audit) event.audit.setUpdatedBy(command.audit.userId)
    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
