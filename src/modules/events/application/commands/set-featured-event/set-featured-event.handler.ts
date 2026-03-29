import {
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { SetFeaturedEventCommand } from './set-featured-event.command'

@CommandHandler(SetFeaturedEventCommand)
export class SetFeaturedEventHandler implements ICommandHandler<SetFeaturedEventCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
  ) {}

  async execute(command: SetFeaturedEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    await this.writeRepo.setFeatured(command.eventId, command.isFeatured)

    return { id: command.eventId }
  }
}
