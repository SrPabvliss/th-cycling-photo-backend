import { Event } from '@events/domain/entities'
import { EVENT_WRITE_REPOSITORY, type IEventWriteRepository } from '@events/domain/ports'
import { LocationValidator } from '@locations/application/services'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { CreateEventCommand } from './create-event.command'

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    private readonly locationValidator: LocationValidator,
  ) {}

  /** Creates a new event entity and persists it. */
  async execute(command: CreateEventCommand): Promise<EntityIdProjection> {
    await this.locationValidator.validate(command.provinceId, command.cantonId)

    const event = Event.create({
      name: command.name,
      date: command.date,
      location: command.location,
      provinceId: command.provinceId,
      cantonId: command.cantonId,
    })

    const saved = await this.writeRepo.save(event)

    return { id: saved.id }
  }
}
